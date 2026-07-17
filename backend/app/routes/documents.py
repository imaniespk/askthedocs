import mimetypes
from pathlib import Path
from uuid import UUID, uuid4

import mammoth
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_pool
from app.dependencies import get_current_user
from app.worker.processor import process_document

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class DocumentOut(BaseModel):
    id: UUID
    filename: str
    size_bytes: int
    status: str
    created_at: str


class ContentOut(BaseModel):
    type: str
    content: str


@router.post("/", response_model=DocumentOut, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user),
):
    allowed = (".pdf", ".docx", ".txt")
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT files are supported.")

    content = await file.read()
    size_bytes = len(content)

    if size_bytes > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_upload_size_mb} MB limit.",
        )

    pool = await get_pool()
    existing = await pool.fetchrow(
        "SELECT id FROM documents WHERE filename = $1 AND user_id = $2",
        file.filename, user_id,
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f'"{file.filename}" is already uploaded. Delete it first or rename the file.',
        )

    doc_id = uuid4()
    suffix = Path(file.filename).suffix.lower()
    file_path = UPLOAD_DIR / f"{doc_id}{suffix}"
    file_path.write_bytes(content)
    del content

    row = await pool.fetchrow(
        """
        INSERT INTO documents (id, filename, storage_path, size_bytes, status, user_id)
        VALUES ($1, $2, $3, $4, 'pending', $5)
        RETURNING id, filename, size_bytes, status, created_at
        """,
        doc_id,
        file.filename,
        str(file_path),
        size_bytes,
        user_id,
    )

    background_tasks.add_task(process_document, doc_id)

    return DocumentOut(
        id=row["id"],
        filename=row["filename"],
        size_bytes=row["size_bytes"],
        status=row["status"],
        created_at=str(row["created_at"]),
    )


@router.get("/", response_model=list[DocumentOut])
async def list_documents(user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, filename, size_bytes, status, created_at
        FROM documents
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_id,
    )
    return [
        DocumentOut(
            id=r["id"],
            filename=r["filename"],
            size_bytes=r["size_bytes"],
            status=r["status"],
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


GROUP_ACCESS_QUERY = """
    SELECT storage_path, filename FROM documents
    WHERE id = $1 AND (
        user_id = $2
        OR EXISTS (
            SELECT 1 FROM group_documents gd
            JOIN group_members gm ON gm.group_id = gd.group_id
            WHERE gd.document_id = $1 AND gm.user_id = $2
        )
    )
"""


@router.get("/{document_id}/file")
async def serve_file(document_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(GROUP_ACCESS_QUERY, document_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = Path(row["storage_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk.")

    media_type, _ = mimetypes.guess_type(row["filename"])
    return FileResponse(
        path=str(file_path),
        media_type=media_type or "application/octet-stream",
        filename=row["filename"],
    )


@router.get("/{document_id}/content", response_model=ContentOut)
async def get_content(document_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(GROUP_ACCESS_QUERY, document_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = Path(row["storage_path"])
    suffix = file_path.suffix.lower()

    if suffix == ".docx":
        with open(file_path, "rb") as f:
            result = mammoth.convert_to_html(f)
        return ContentOut(type="html", content=result.value)

    if suffix == ".txt":
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        return ContentOut(type="text", content=text)

    raise HTTPException(status_code=400, detail="Use the /file endpoint for PDF preview.")


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT storage_path FROM documents WHERE id = $1 AND user_id = $2",
        document_id,
        user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = Path(row["storage_path"])
    if file_path.exists():
        file_path.unlink()

    await pool.execute("DELETE FROM documents WHERE id = $1", document_id)

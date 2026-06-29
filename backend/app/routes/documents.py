from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_pool
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


@router.post("/", response_model=DocumentOut, status_code=201)
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    size_bytes = len(content)

    if size_bytes > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_upload_size_mb} MB limit.",
        )

    doc_id = uuid4()
    file_path = UPLOAD_DIR / f"{doc_id}.pdf"
    file_path.write_bytes(content)

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO documents (id, filename, storage_path, size_bytes, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id, filename, size_bytes, status, created_at
        """,
        doc_id,
        file.filename,
        str(file_path),
        size_bytes,
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
async def list_documents():
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, filename, size_bytes, status, created_at
        FROM documents
        ORDER BY created_at DESC
        """
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


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: UUID):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT storage_path FROM documents WHERE id = $1", document_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = Path(row["storage_path"])
    if file_path.exists():
        file_path.unlink()

    await pool.execute("DELETE FROM documents WHERE id = $1", document_id)

from pathlib import Path
from uuid import UUID

import pdfplumber
from docx import Document as DocxDocument
from openai import AsyncOpenAI

from app.config import settings
from app.db.database import get_pool

_openai = AsyncOpenAI(api_key=settings.openai_api_key)

CHUNK_WORDS = 500


def _split_chunks(text: str) -> list[str]:
    words = text.split()
    return [
        " ".join(words[i : i + CHUNK_WORDS])
        for i in range(0, len(words), CHUNK_WORDS)
        if words[i : i + CHUNK_WORDS]
    ]


def _extract_text(storage_path: str) -> list[tuple[str, int]]:
    path = Path(storage_path)
    suffix = path.suffix.lower()
    chunks: list[tuple[str, int]] = []

    if suffix == ".pdf":
        with pdfplumber.open(storage_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                for chunk in _split_chunks(text):
                    if chunk.strip():
                        chunks.append((chunk, page_num))

    elif suffix == ".docx":
        doc = DocxDocument(storage_path)
        full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        for chunk in _split_chunks(full_text):
            if chunk.strip():
                chunks.append((chunk, 1))

    elif suffix == ".txt":
        text = path.read_text(encoding="utf-8", errors="ignore")
        for chunk in _split_chunks(text):
            if chunk.strip():
                chunks.append((chunk, 1))

    return chunks


async def process_document(document_id: UUID) -> None:
    pool = await get_pool()

    await pool.execute(
        "UPDATE documents SET status = 'processing', updated_at = NOW() WHERE id = $1",
        document_id,
    )

    try:
        row = await pool.fetchrow(
            "SELECT storage_path FROM documents WHERE id = $1", document_id
        )

        chunks = _extract_text(row["storage_path"])

        if not chunks:
            await pool.execute(
                "UPDATE documents SET status = 'error', updated_at = NOW() WHERE id = $1",
                document_id,
            )
            return

        for idx, (chunk_text, page_num) in enumerate(chunks):
            response = await _openai.embeddings.create(
                model="text-embedding-3-small",
                input=chunk_text,
            )
            vector = response.data[0].embedding
            vector_str = f"[{','.join(str(x) for x in vector)}]"

            await pool.execute(
                """
                INSERT INTO chunks (document_id, chunk_index, content, embedding, page_number)
                VALUES ($1, $2, $3, $4::vector, $5)
                """,
                document_id,
                idx,
                chunk_text,
                vector_str,
                page_num,
            )

        await pool.execute(
            "UPDATE documents SET status = 'ready', updated_at = NOW() WHERE id = $1",
            document_id,
        )

    except Exception:
        await pool.execute(
            "UPDATE documents SET status = 'error', updated_at = NOW() WHERE id = $1",
            document_id,
        )
        raise

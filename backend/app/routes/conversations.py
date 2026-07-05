from uuid import UUID

from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_pool

router = APIRouter(prefix="/conversations", tags=["conversations"])

_openai = AsyncOpenAI(api_key=settings.openai_api_key)

TOP_K = 3


class ConversationOut(BaseModel):
    id: UUID
    title: str | None
    created_at: str


class MessageIn(BaseModel):
    question: str
    document_ids: list[UUID] | None = None  # if None, search all documents


class SourceChunk(BaseModel):
    chunk_id: UUID
    filename: str
    page_number: int | None
    content: str


class MessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    sources: list[SourceChunk]
    created_at: str


@router.post("/", response_model=ConversationOut, status_code=201)
async def create_conversation():
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO conversations DEFAULT VALUES RETURNING id, title, created_at"
    )
    return ConversationOut(
        id=row["id"],
        title=row["title"],
        created_at=str(row["created_at"]),
    )


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def ask_question(conversation_id: UUID, body: MessageIn):
    pool = await get_pool()

    conv = await pool.fetchrow(
        "SELECT id FROM conversations WHERE id = $1", conversation_id
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    # Embed the question
    embed_resp = await _openai.embeddings.create(
        model="text-embedding-3-small",
        input=body.question,
    )
    q_vector = embed_resp.data[0].embedding
    q_vector_str = f"[{','.join(str(x) for x in q_vector)}]"

    # Find top-K most relevant chunks via cosine similarity
    if body.document_ids:
        chunk_rows = await pool.fetch(
            """
            SELECT c.id, c.content, c.page_number, d.filename
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE c.document_id = ANY($2::uuid[])
            ORDER BY c.embedding <=> $1::vector
            LIMIT $3
            """,
            q_vector_str,
            body.document_ids,
            TOP_K,
        )
    else:
        chunk_rows = await pool.fetch(
            """
            SELECT c.id, c.content, c.page_number, d.filename
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            ORDER BY c.embedding <=> $1::vector
            LIMIT $2
            """,
            q_vector_str,
            TOP_K,
        )

    if not chunk_rows:
        raise HTTPException(
            status_code=422,
            detail="No documents uploaded yet. Please upload a PDF first.",
        )

    # Build context for the LLM
    context = "\n\n---\n\n".join(
        f"[From: {r['filename']}, page {r['page_number']}]\n{r['content']}"
        for r in chunk_rows
    )

    prompt = f"""You are a helpful assistant that answers questions based only on the provided document excerpts.
If the answer is not found in the excerpts, say "I couldn't find that information in the uploaded documents."

Document excerpts:
{context}

Question: {body.question}

Answer:"""

    completion = await _openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    answer = completion.choices[0].message.content.strip()
    found_in_docs = "couldn't find" not in answer.lower()

    # Save user message
    await pool.execute(
        """
        INSERT INTO messages (conversation_id, role, content)
        VALUES ($1, 'user', $2)
        """,
        conversation_id,
        body.question,
    )

    # Save assistant message with source chunk IDs
    source_ids = [r["id"] for r in chunk_rows] if found_in_docs else []
    msg_row = await pool.fetchrow(
        """
        INSERT INTO messages (conversation_id, role, content, source_chunks)
        VALUES ($1, 'assistant', $2, $3)
        RETURNING id, role, content, created_at
        """,
        conversation_id,
        answer,
        source_ids,
    )

    sources = (
        [
            SourceChunk(
                chunk_id=r["id"],
                filename=r["filename"],
                page_number=r["page_number"],
                content=r["content"],
            )
            for r in chunk_rows
        ]
        if found_in_docs
        else []
    )

    return MessageOut(
        id=msg_row["id"],
        role=msg_row["role"],
        content=msg_row["content"],
        sources=sources,
        created_at=str(msg_row["created_at"]),
    )

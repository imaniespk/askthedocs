from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings
from app.db.database import get_pool
from app.dependencies import get_current_user

router = APIRouter(prefix="/conversations", tags=["conversations"])

_openai = AsyncOpenAI(api_key=settings.openai_api_key)

TOP_K = 3


class TitleIn(BaseModel):
    title: str


class ConversationOut(BaseModel):
    id: UUID
    title: str | None
    created_at: str


class MessageIn(BaseModel):
    question: str
    document_ids: list[UUID] | None = None


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


@router.get("/", response_model=list[ConversationOut])
async def list_conversations(user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, title, created_at
        FROM conversations
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_id,
    )
    return [
        ConversationOut(id=r["id"], title=r["title"], created_at=str(r["created_at"]))
        for r in rows
    ]


@router.post("/", response_model=ConversationOut, status_code=201)
async def create_conversation(user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO conversations (user_id) VALUES ($1) RETURNING id, title, created_at",
        user_id,
    )
    return ConversationOut(
        id=row["id"],
        title=row["title"],
        created_at=str(row["created_at"]),
    )


@router.patch("/{conversation_id}/title", response_model=ConversationOut)
async def update_title(
    conversation_id: UUID,
    body: TitleIn,
    user_id: UUID = Depends(get_current_user),
):
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE conversations SET title = $1
        WHERE id = $2 AND user_id = $3
        RETURNING id, title, created_at
        """,
        body.title[:60],
        conversation_id,
        user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return ConversationOut(id=row["id"], title=row["title"], created_at=str(row["created_at"]))


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
        conversation_id,
        user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    await pool.execute("DELETE FROM conversations WHERE id = $1", conversation_id)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(conversation_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    conv = await pool.fetchrow(
        "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
        conversation_id,
        user_id,
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    rows = await pool.fetch(
        """
        SELECT id, role, content, source_chunks, created_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        """,
        conversation_id,
    )

    result = []
    for r in rows:
        sources = []
        if r["source_chunks"]:
            chunk_rows = await pool.fetch(
                """
                SELECT c.id, c.content, c.page_number, d.filename
                FROM chunks c
                JOIN documents d ON d.id = c.document_id
                WHERE c.id = ANY($1::uuid[])
                """,
                r["source_chunks"],
            )
            sources = [
                SourceChunk(
                    chunk_id=cr["id"],
                    filename=cr["filename"],
                    page_number=cr["page_number"],
                    content=cr["content"],
                )
                for cr in chunk_rows
            ]
        result.append(
            MessageOut(
                id=r["id"],
                role=r["role"],
                content=r["content"],
                sources=sources,
                created_at=str(r["created_at"]),
            )
        )
    return result


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
async def ask_question(
    conversation_id: UUID,
    body: MessageIn,
    user_id: UUID = Depends(get_current_user),
):
    pool = await get_pool()

    conv = await pool.fetchrow(
        "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
        conversation_id,
        user_id,
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    embed_resp = await _openai.embeddings.create(
        model="text-embedding-3-small",
        input=body.question,
    )
    q_vector = embed_resp.data[0].embedding
    q_vector_str = f"[{','.join(str(x) for x in q_vector)}]"

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
            WHERE d.user_id = $2
            ORDER BY c.embedding <=> $1::vector
            LIMIT $3
            """,
            q_vector_str,
            user_id,
            TOP_K,
        )

    if not chunk_rows:
        raise HTTPException(
            status_code=422,
            detail="No documents uploaded yet. Please upload a document first.",
        )

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

    await pool.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)",
        conversation_id,
        body.question,
    )

    # Set conversation title from first question
    await pool.execute(
        "UPDATE conversations SET title = $1 WHERE id = $2 AND title IS NULL",
        body.question[:60],
        conversation_id,
    )

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

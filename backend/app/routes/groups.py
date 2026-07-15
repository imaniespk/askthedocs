import random
import string
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.database import get_pool
from app.dependencies import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])


def _make_invite_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class GroupIn(BaseModel):
    name: str


class GroupOut(BaseModel):
    id: UUID
    name: str
    invite_code: str
    created_by: UUID
    created_at: str


class MemberOut(BaseModel):
    user_id: UUID
    email: str
    role: str
    joined_at: str


class GroupDocumentOut(BaseModel):
    id: UUID
    filename: str
    size_bytes: int
    status: str
    owner_email: str


@router.post("/", response_model=GroupOut, status_code=201)
async def create_group(body: GroupIn, user_id: UUID = Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Group name cannot be empty.")
    pool = await get_pool()
    invite_code = _make_invite_code()
    row = await pool.fetchrow(
        """
        INSERT INTO groups (name, invite_code, created_by)
        VALUES ($1, $2, $3)
        RETURNING id, name, invite_code, created_by, created_at
        """,
        body.name.strip(),
        invite_code,
        user_id,
    )
    await pool.execute(
        "INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')",
        row["id"],
        user_id,
    )
    return GroupOut(
        id=row["id"],
        name=row["name"],
        invite_code=row["invite_code"],
        created_by=row["created_by"],
        created_at=str(row["created_at"]),
    )


@router.post("/join", response_model=GroupOut)
async def join_group(invite_code: str, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    group = await pool.fetchrow(
        "SELECT id, name, invite_code, created_by, created_at FROM groups WHERE invite_code = $1",
        invite_code.upper(),
    )
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code.")
    existing = await pool.fetchrow(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        group["id"],
        user_id,
    )
    if existing:
        raise HTTPException(status_code=409, detail="You are already a member of this group.")
    await pool.execute(
        "INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')",
        group["id"],
        user_id,
    )
    return GroupOut(
        id=group["id"],
        name=group["name"],
        invite_code=group["invite_code"],
        created_by=group["created_by"],
        created_at=str(group["created_at"]),
    )


@router.get("/", response_model=list[GroupOut])
async def list_groups(user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT g.id, g.name, g.invite_code, g.created_by, g.created_at
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = $1
        ORDER BY g.created_at DESC
        """,
        user_id,
    )
    return [
        GroupOut(
            id=r["id"],
            name=r["name"],
            invite_code=r["invite_code"],
            created_by=r["created_by"],
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


@router.get("/{group_id}/members", response_model=list[MemberOut])
async def list_members(group_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    member = await pool.fetchrow(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        group_id,
        user_id,
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group.")
    rows = await pool.fetch(
        """
        SELECT gm.user_id, u.email, gm.role, gm.joined_at
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
        ORDER BY gm.joined_at ASC
        """,
        group_id,
    )
    return [
        MemberOut(
            user_id=r["user_id"],
            email=r["email"],
            role=r["role"],
            joined_at=str(r["joined_at"]),
        )
        for r in rows
    ]


@router.get("/{group_id}/documents", response_model=list[GroupDocumentOut])
async def list_group_documents(group_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    member = await pool.fetchrow(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        group_id,
        user_id,
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group.")
    rows = await pool.fetch(
        """
        SELECT d.id, d.filename, d.size_bytes, d.status, u.email AS owner_email
        FROM group_documents gd
        JOIN documents d ON d.id = gd.document_id
        JOIN users u ON u.id = d.user_id
        WHERE gd.group_id = $1
        ORDER BY d.created_at DESC
        """,
        group_id,
    )
    return [
        GroupDocumentOut(
            id=r["id"],
            filename=r["filename"],
            size_bytes=r["size_bytes"],
            status=r["status"],
            owner_email=r["owner_email"],
        )
        for r in rows
    ]


@router.post("/{group_id}/documents/{document_id}", status_code=204)
async def share_document(
    group_id: UUID,
    document_id: UUID,
    user_id: UUID = Depends(get_current_user),
):
    pool = await get_pool()
    member = await pool.fetchrow(
        "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2",
        group_id,
        user_id,
    )
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group.")
    doc = await pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
        document_id,
        user_id,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or not yours.")
    existing = await pool.fetchrow(
        "SELECT 1 FROM group_documents WHERE group_id = $1 AND document_id = $2",
        group_id,
        document_id,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Document already shared with this group.")
    await pool.execute(
        "INSERT INTO group_documents (group_id, document_id) VALUES ($1, $2)",
        group_id,
        document_id,
    )


@router.delete("/{group_id}/documents/{document_id}", status_code=204)
async def unshare_document(
    group_id: UUID,
    document_id: UUID,
    user_id: UUID = Depends(get_current_user),
):
    pool = await get_pool()
    doc = await pool.fetchrow(
        "SELECT id FROM documents WHERE id = $1 AND user_id = $2",
        document_id,
        user_id,
    )
    if not doc:
        raise HTTPException(status_code=403, detail="You can only remove your own documents.")
    await pool.execute(
        "DELETE FROM group_documents WHERE group_id = $1 AND document_id = $2",
        group_id,
        document_id,
    )


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: UUID, user_id: UUID = Depends(get_current_user)):
    pool = await get_pool()
    group = await pool.fetchrow(
        "SELECT created_by FROM groups WHERE id = $1",
        group_id,
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    if group["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only the group owner can delete the group.")
    await pool.execute("DELETE FROM groups WHERE id = $1", group_id)

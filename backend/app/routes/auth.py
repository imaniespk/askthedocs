from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import create_access_token, hash_password, verify_password
from app.db.database import get_pool

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenOut, status_code=201)
async def register(body: AuthIn):
    pool = await get_pool()
    existing = await pool.fetchrow("SELECT id FROM users WHERE email = $1", body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    hashed = hash_password(body.password)
    row = await pool.fetchrow(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        body.email,
        hashed,
    )
    return TokenOut(access_token=create_access_token(row["id"]))


@router.post("/login", response_model=TokenOut)
async def login(body: AuthIn):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, password_hash FROM users WHERE email = $1", body.email
    )
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return TokenOut(access_token=create_access_token(row["id"]))

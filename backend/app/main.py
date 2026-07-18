from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import close_pool, get_pool
from app.routes import auth, conversations, documents, groups


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url:
        pool = await get_pool()
        await pool.execute(
            "UPDATE documents SET status = 'error' WHERE status = 'processing'"
        )
    yield
    await close_pool()


app = FastAPI(
    title="AskTheDocs API",
    version="0.9.0",
    lifespan=lifespan,
    docs_url=None if settings.env == "production" else "/docs",
    redoc_url=None if settings.env == "production" else "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(conversations.router)
app.include_router(groups.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.9.0"}

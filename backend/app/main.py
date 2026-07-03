from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import close_pool, get_pool
from app.routes import conversations, documents


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url:
        await get_pool()
    yield
    await close_pool()


app = FastAPI(title="AskTheDocs API", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(conversations.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.4.0"}

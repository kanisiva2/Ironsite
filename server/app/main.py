import logging
from contextlib import asynccontextmanager

import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import projects, rooms, chat, generate_2d, generate_artifact, generate_3d, messages


@asynccontextmanager
async def lifespan(app: FastAPI):
    cred = credentials.Certificate(settings.firebase_service_account_path)
    firebase_admin.initialize_app(cred)
    logging.info("Firebase Admin initialized")
    yield


app = FastAPI(
    title="Ironsite API",
    description="AI Architect Studio backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(rooms.router)
app.include_router(messages.router)
app.include_router(chat.router)
app.include_router(generate_2d.router)
app.include_router(generate_artifact.router)
app.include_router(generate_3d.router)

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}

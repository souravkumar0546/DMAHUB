from __future__ import annotations

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes import health, dedup_group, lookup, classification, enrichment, master_builder, classify

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


app = FastAPI(title="Syngene Agent Hub API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(dedup_group.router, prefix="/api")
app.include_router(lookup.router, prefix="/api")
app.include_router(classification.router, prefix="/api")
app.include_router(enrichment.router, prefix="/api")
app.include_router(master_builder.router, prefix="/api")
app.include_router(classify.router, prefix="/api")


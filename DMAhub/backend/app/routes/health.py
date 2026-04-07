from __future__ import annotations

import os
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"ok": True}


@router.get("/config")
def config() -> dict:
    azure_ready = bool(
        os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
        and os.getenv("AZURE_OPENAI_API_KEY", "").strip()
        and os.getenv("AZURE_OPENAI_MODEL", "").strip()
    )
    return {"azure_ready": azure_ready}


@router.post("/upload-preview")
async def upload_preview(file: UploadFile = File(...)) -> dict:
    try:
        raw = await file.read()
        df = pd.read_excel(BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read file: {exc}")

    columns = df.columns.tolist()
    preview = df.head(10).fillna("").astype(str).to_dict(orient="records")
    stats = {}
    for col in columns:
        stats[col] = {
            "non_null": int(df[col].notna().sum()),
            "unique": int(df[col].nunique()),
        }
    return {
        "columns": columns,
        "row_count": len(df),
        "preview": preview,
        "stats": stats,
    }

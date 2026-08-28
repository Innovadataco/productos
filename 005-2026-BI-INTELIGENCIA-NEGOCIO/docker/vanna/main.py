"""Vanna BI stub · Fase 1 · solo /health. Motor NL-to-SQL en SPEC-003."""
from fastapi import FastAPI

app = FastAPI(title="BI Vanna stub", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "bi-vanna", "fase": 1}

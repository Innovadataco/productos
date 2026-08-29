"""FastAPI app bi-vanna · endpoints /health y /generate."""
from __future__ import annotations

import logging
import os
from time import perf_counter
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .jurado import ResultadoJurado, deliberar
from .ollama_client import OllamaError, generar_estructurado, listar_modelos

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("main")

app = FastAPI(title="bi-vanna", version="1.0.0")


class GenerarBody(BaseModel):
    pregunta_nl: str = Field(..., alias="preguntaNL", min_length=1)
    catalogo: dict[str, Any]
    contexto: dict[str, Any] | None = None
    modelos: list[str] | None = None

    model_config = {"populate_by_name": True}


def _resultado_a_json(r: ResultadoJurado) -> dict[str, Any]:
    return {
        "consenso": r.consenso,
        "sqlGenerado": r.sql_generado,
        "razon": r.razon,
        "grupoDominante": r.grupo_dominante,
        "latencias": r.latencias,
        "votosJurado": [
            {
                "modelo": v.modelo,
                "sqlCrudo": v.sql_crudo,
                "sqlCanonico": v.sql_canonico,
                "error": v.error,
                "latenciaMs": v.latencia_ms,
                "slotsFaltantes": v.slots_faltantes,
            }
            for v in r.votos_jurado
        ],
    }


@app.post("/generate")
async def generate(body: GenerarBody) -> dict[str, Any]:
    try:
        r = await deliberar(
            pregunta=body.pregunta_nl,
            catalogo=body.catalogo,
            contexto=body.contexto,
            modelos=body.modelos,
        )
    except OllamaError as e:
        log.error("ollama_unreachable_en_generate err=%s", e)
        raise HTTPException(status_code=500, detail={"error": "ollama_unreachable", "msg": str(e)})
    return _resultado_a_json(r)


@app.get("/health")
async def health() -> dict[str, Any]:
    t0 = perf_counter()
    modelos_configurados = [
        m.strip()
        for m in os.getenv(
            "LLM_MODELS_JURADO", "qwen2.5:14b,gemma2:27b,aya-expanse:32b"
        ).split(",")
        if m.strip()
    ]
    try:
        instalados = await listar_modelos(timeout_s=3.0)
        latencia_ms = int((perf_counter() - t0) * 1000)
        disponibles = [m for m in modelos_configurados if m in instalados]
        ok = len(disponibles) >= 2
        return {
            "ok": ok,
            "service": "bi-vanna",
            "modelosDisponibles": disponibles,
            "modelosConfigurados": modelos_configurados,
            "ollamaLatMs": latencia_ms,
        }
    except OllamaError as e:
        return {
            "ok": False,
            "service": "bi-vanna",
            "modelosDisponibles": [],
            "modelosConfigurados": modelos_configurados,
            "ollamaError": str(e),
        }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)

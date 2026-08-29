"""Cliente HTTP hacia Ollama · candados 2 (temp0/seed42/structured output)
· 3 (keep_alive) · 5 (metrics para el jurado)."""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

import httpx

log = logging.getLogger("ollama_client")

DEFAULT_TIMEOUT_S = 90.0
DEFAULT_KEEP_ALIVE_H = int(os.getenv("KEEP_ALIVE_H", "24"))


@dataclass
class OllamaMetrics:
    latencia_ms: int
    prompt_tokens: int | None = None
    response_tokens: int | None = None
    load_duration_ms: int | None = None


@dataclass
class OllamaResultado:
    data: dict[str, Any]
    raw_response: str
    metrics: OllamaMetrics
    metadatos: dict[str, Any] = field(default_factory=dict)


class OllamaError(RuntimeError):
    """Cualquier fallo hablando con Ollama (timeout, HTTP, JSON inválido)."""


async def generar_estructurado(
    modelo: str,
    prompt: str,
    schema: dict[str, Any],
    system: str | None = None,
    options: dict[str, Any] | None = None,
    keep_alive_h: int | None = None,
    base_url: str | None = None,
    client: httpx.AsyncClient | None = None,
    timeout_s: float = DEFAULT_TIMEOUT_S,
) -> OllamaResultado:
    """Llama POST /api/generate de Ollama con structured output.

    Candado 2: options siempre lleva temperature=0 y seed=42 (defaults duros).
    Candado 3: keep_alive obligatorio para preservar modelos calientes.
    """
    base = base_url or os.getenv("OLLAMA_BASE_URL", "http://100.91.87.86:11435")
    opts = {"temperature": 0, "seed": 42}
    if options:
        opts.update(options)
    keep_alive = f"{keep_alive_h if keep_alive_h is not None else DEFAULT_KEEP_ALIVE_H}h"
    body: dict[str, Any] = {
        "model": modelo,
        "prompt": prompt,
        "stream": False,
        "format": schema,
        "options": opts,
        "keep_alive": keep_alive,
    }
    if system:
        body["system"] = system

    close_after = client is None
    if client is None:
        client = httpx.AsyncClient(timeout=timeout_s)
    try:
        try:
            resp = await client.post(f"{base}/api/generate", json=body)
        except httpx.TimeoutException as e:
            log.warning("ollama_timeout modelo=%s err=%s", modelo, e)
            raise OllamaError(f"timeout:{e}") from e
        except httpx.HTTPError as e:
            log.warning("ollama_http_error modelo=%s err=%s", modelo, e)
            raise OllamaError(f"http:{e}") from e

        if resp.status_code != 200:
            raise OllamaError(f"http_{resp.status_code}:{resp.text[:200]}")

        payload = resp.json()
        raw = payload.get("response", "")
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError as e:
            log.warning("ollama_bad_json modelo=%s raw=%s", modelo, raw[:200])
            raise OllamaError(f"bad_json:{e}") from e
        if not isinstance(data, dict):
            raise OllamaError("respuesta_no_es_objeto")

        metrics = OllamaMetrics(
            latencia_ms=int(payload.get("total_duration", 0) / 1_000_000)
            if isinstance(payload.get("total_duration"), int)
            else 0,
            prompt_tokens=payload.get("prompt_eval_count"),
            response_tokens=payload.get("eval_count"),
            load_duration_ms=int(payload.get("load_duration", 0) / 1_000_000)
            if isinstance(payload.get("load_duration"), int)
            else None,
        )
        return OllamaResultado(data=data, raw_response=raw, metrics=metrics)
    finally:
        if close_after:
            await client.aclose()


async def listar_modelos(base_url: str | None = None, timeout_s: float = 3.0) -> list[str]:
    base = base_url or os.getenv("OLLAMA_BASE_URL", "http://100.91.87.86:11435")
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        try:
            resp = await client.get(f"{base}/api/tags")
        except httpx.HTTPError as e:
            raise OllamaError(f"tags_http:{e}") from e
    if resp.status_code != 200:
        raise OllamaError(f"tags_status_{resp.status_code}")
    data = resp.json()
    modelos = data.get("models", []) if isinstance(data, dict) else []
    return [m.get("name", "") for m in modelos if isinstance(m, dict) and m.get("name")]

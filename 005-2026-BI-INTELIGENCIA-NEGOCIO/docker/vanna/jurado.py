"""Jurado 2/3 multi-modelo · candados 4 (checks atómicos deny-by-default)
· 5 (voto de mayoría sobre AST canónico)."""
from __future__ import annotations

import logging
import os
from collections import Counter
from dataclasses import dataclass, field
from time import perf_counter
from typing import Any, Callable, Awaitable

from .canonizador import CanonizadorError, canonicalizar
from .ollama_client import OllamaError, OllamaResultado, generar_estructurado
from .schema_builder import SYSTEM_ES, construir_prompt_generacion
from .traductor_idx import IdxFueraDeRango, construir_sql

log = logging.getLogger("jurado")

SLOTS_REQUERIDOS = ("agregacion", "filtros", "agrupacion")


@dataclass
class VotoModelo:
    modelo: str
    sql_crudo: str | None = None
    sql_canonico: str | None = None
    error: str | None = None
    latencia_ms: int | None = None
    respuesta_llm: dict[str, Any] | None = None
    slots_faltantes: list[str] = field(default_factory=list)


@dataclass
class ResultadoJurado:
    consenso: bool
    sql_generado: str | None
    razon: str | None
    votos_jurado: list[VotoModelo]
    grupo_dominante: list[str]
    latencias: dict[str, int]


def _slots_faltantes(respuesta: dict[str, Any]) -> list[str]:
    """Candado 4: cualquier slot null con nota != "" cuenta como faltante."""
    nota = respuesta.get("nota", "") or ""
    if not nota.strip():
        return []
    faltantes: list[str] = []
    for slot in SLOTS_REQUERIDOS:
        if respuesta.get(slot) is None:
            faltantes.append(slot)
    return faltantes


LlamarModeloFn = Callable[[str, str, dict[str, Any]], Awaitable[OllamaResultado]]


async def _llamar_ollama_default(
    modelo: str, prompt: str, schema: dict[str, Any]
) -> OllamaResultado:
    return await generar_estructurado(
        modelo=modelo, prompt=prompt, schema=schema, system=SYSTEM_ES
    )


async def deliberar(
    pregunta: str,
    catalogo: dict[str, Any],
    contexto: dict[str, Any] | None = None,
    modelos: list[str] | None = None,
    llamar_modelo: LlamarModeloFn | None = None,
) -> ResultadoJurado:
    modelos = modelos or [
        m.strip()
        for m in os.getenv(
            "LLM_MODELS_JURADO", "qwen2.5:14b,gemma2:27b,aya-expanse:32b"
        ).split(",")
        if m.strip()
    ]
    llamar = llamar_modelo or _llamar_ollama_default
    prompt, schema = construir_prompt_generacion(pregunta, catalogo, contexto)

    votos: list[VotoModelo] = []
    for modelo in modelos:
        v = VotoModelo(modelo=modelo)
        t0 = perf_counter()
        try:
            res = await llamar(modelo, prompt, schema)
            v.latencia_ms = int((perf_counter() - t0) * 1000)
            v.respuesta_llm = res.data
            slots = _slots_faltantes(res.data)
            v.slots_faltantes = slots
            if slots:
                v.error = f"checks_atomicos_incompletos:{','.join(slots)}"
            else:
                sql_crudo = construir_sql(res.data, catalogo)
                v.sql_crudo = sql_crudo
                v.sql_canonico = canonicalizar(sql_crudo)
        except IdxFueraDeRango as e:
            v.error = str(e)
        except CanonizadorError as e:
            v.error = f"canonizador:{e}"
        except OllamaError as e:
            v.error = f"ollama:{e}"
        except Exception as e:  # noqa: BLE001
            v.error = f"unknown:{e}"
            log.exception("voto_error modelo=%s", modelo)
        votos.append(v)

    # Voto atómico: si ≥2/3 tienen slots faltantes → REVISION (candado 4)
    faltantes_count = sum(1 for v in votos if v.slots_faltantes)
    if faltantes_count >= 2:
        return ResultadoJurado(
            consenso=False,
            sql_generado=None,
            razon="checks_atomicos_incompletos",
            votos_jurado=votos,
            grupo_dominante=[],
            latencias={v.modelo: v.latencia_ms or 0 for v in votos},
        )

    validos = [v for v in votos if v.sql_canonico]
    if len(validos) < 2:
        return ResultadoJurado(
            consenso=False,
            sql_generado=None,
            razon="sin_votos_validos" if not validos else "un_solo_voto_valido",
            votos_jurado=votos,
            grupo_dominante=[],
            latencias={v.modelo: v.latencia_ms or 0 for v in votos},
        )

    canonicos = [v.sql_canonico for v in validos if v.sql_canonico is not None]
    conteo = Counter(canonicos)
    canon_dominante, cardinalidad = conteo.most_common(1)[0]
    if cardinalidad < 2:
        return ResultadoJurado(
            consenso=False,
            sql_generado=None,
            razon="sin_consenso",
            votos_jurado=votos,
            grupo_dominante=[],
            latencias={v.modelo: v.latencia_ms or 0 for v in votos},
        )
    grupo = [v.modelo for v in validos if v.sql_canonico == canon_dominante]
    sql_generado = next(
        v.sql_crudo for v in validos if v.sql_canonico == canon_dominante
    )
    return ResultadoJurado(
        consenso=True,
        sql_generado=sql_generado,
        razon=None,
        votos_jurado=votos,
        grupo_dominante=grupo,
        latencias={v.modelo: v.latencia_ms or 0 for v in votos},
    )

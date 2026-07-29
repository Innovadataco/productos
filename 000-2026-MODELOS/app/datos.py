"""
datos.py — Recolección y agregación del consumo de tokens de Claude Code.

Módulo puro (sin HTTP): lee las transcripciones locales y los metadatos de la app
de escritorio, agrega por sesión, calcula la tendencia diaria y dispara alertas.
Constitución 000-MODELOS: solo lectura, stdlib únicamente, nada sale de la Mac.
"""
import json
import os
import glob
import collections
import datetime

CASA = os.path.expanduser("~")
RAIZ_TRANSCRIPCIONES = os.path.join(CASA, ".claude", "projects")
RAIZ_APP = os.path.join(
    CASA, "Library", "Application Support", "Claude", "claude-code-sessions"
)

# Tarifa de REFERENCIA (USD por millón, Opus API pública). En plan Max no se
# factura: el panel la etiqueta siempre como "peso comparativo".
PRECIOS = {"in": 15.0, "out": 75.0, "cw": 18.75, "cr": 1.50}

# FR-004: umbrales centralizados — un solo lugar.
UMBRALES = {
    "limite_contexto": 200_000,   # ventana de referencia del modelo
    "contexto_warn": 0.75,        # ≥75% → WARNING
    "contexto_crit": 0.90,        # ≥90% → CRITICAL
    "inflada_media": 150_000,     # contexto medio por turno
    "inflada_turnos_min": 5,      # mínimo de turnos para considerarla
    "activa_minutos": 15,         # mtime < 15 min = ACTIVA
    "max_activas": 3,             # ≥3 activas a la vez → aviso
}


def peso_usd(s):
    """Peso comparativo en USD de una sesión agregada."""
    return (
        s["in"] * PRECIOS["in"] + s["out"] * PRECIOS["out"]
        + s["cw"] * PRECIOS["cw"] + s["cr"] * PRECIOS["cr"]
    ) / 1e6


def titulos():
    """{cliSessionId: titulo} desde los datos de la app de escritorio."""
    idx = {}
    for f in glob.glob(os.path.join(RAIZ_APP, "**", "local_*.json"), recursive=True):
        try:
            with open(f) as fh:
                d = json.load(fh)
        except (OSError, ValueError):
            continue
        sid = d.get("cliSessionId")
        if sid and d.get("title"):
            idx[sid] = str(d["title"])
    return idx


def primer_mensaje(ruta, max_len=40):
    """Primer mensaje humano de una transcripción (fallback de nombre)."""
    try:
        with open(ruta, errors="ignore") as fh:
            for linea in fh:
                if '"role":"user"' not in linea:
                    continue
                try:
                    d = json.loads(linea)
                except ValueError:
                    continue
                c = (d.get("message") or {}).get("content")
                if isinstance(c, str) and c.strip() and not c.lstrip().startswith("<"):
                    return " ".join(c.split())[:max_len]
    except OSError:
        pass
    return ""


def _sesion_vacia():
    return {
        "in": 0, "out": 0, "cw": 0, "cr": 0, "turnos": 0,
        "contexto_ultimo": 0, "mtime": 0.0,
    }


def recolectar(dias=1, ahora=None, raiz=None, idx_titulos=None):
    """Agrega las transcripciones de los últimos `dias`.

    Devuelve (sesiones: dict sid->métricas, tendencia: dict fecha->tokens,
    lineas_saltadas: int).
    """
    ahora = ahora or datetime.datetime.now()
    raiz = raiz or RAIZ_TRANSCRIPCIONES
    idx = titulos() if idx_titulos is None else idx_titulos
    fechas = {
        (ahora.date() - datetime.timedelta(days=i)).isoformat() for i in range(dias)
    }
    corte = min(fechas)

    sesiones = {}
    tendencia = collections.defaultdict(lambda: collections.Counter())
    saltadas = 0

    for f in glob.glob(os.path.join(raiz, "**", "*.jsonl"), recursive=True):
        try:
            mtime = os.path.getmtime(f)
        except OSError:
            continue
        if datetime.date.fromtimestamp(mtime).isoformat() < corte:
            continue
        sid = os.path.basename(f)[:-6]
        proyecto = os.path.relpath(f, raiz).split(os.sep)[0]
        s = None
        try:
            fh = open(f, errors="ignore")
        except OSError:
            continue
        with fh:
            for linea in fh:
                if '"usage"' not in linea:
                    continue
                try:
                    d = json.loads(linea)
                except ValueError:
                    saltadas += 1
                    continue
                ts = str(d.get("timestamp", ""))[:10]
                if ts not in fechas:
                    continue
                u = (d.get("message") or {}).get("usage") or {}
                if not u:
                    continue
                if s is None:
                    s = sesiones.setdefault(sid, _sesion_vacia())
                i = u.get("input_tokens", 0) or 0
                o = u.get("output_tokens", 0) or 0
                cw = u.get("cache_creation_input_tokens", 0) or 0
                cr = u.get("cache_read_input_tokens", 0) or 0
                s["turnos"] += 1
                s["in"] += i
                s["out"] += o
                s["cw"] += cw
                s["cr"] += cr
                # Ocupación real del contexto en el último turno visto:
                s["contexto_ultimo"] = i + cw + cr
                dia = tendencia[ts]
                dia["tokens"] += i + o + cw + cr
                dia["turnos"] += 1
        if s is not None:
            s["mtime"] = mtime
            s["proyecto"] = proyecto
            s["sid"] = sid
            s["es_subagente"] = sid.startswith("agent-") or "/subagents/" in f
            titulo = idx.get(sid, "")
            if titulo:
                s["chat"], s["origen_nombre"] = titulo, "app"
            else:
                m = primer_mensaje(f)
                s["chat"] = ('"%s"' % m) if m else "(sin nombre)"
                s["origen_nombre"] = "mensaje"
    return sesiones, dict(tendencia), saltadas


def estado_sesion(mtime, ahora=None):
    """('activa'|'inactiva', etiqueta-de-tiempo)"""
    ahora = ahora or datetime.datetime.now()
    dt = datetime.datetime.fromtimestamp(mtime)
    edad_min = (ahora - dt).total_seconds() / 60.0
    if edad_min < UMBRALES["activa_minutos"]:
        return "activa", dt.strftime("%H:%M")
    if dt.date() == ahora.date():
        return "inactiva", dt.strftime("%H:%M")
    return "inactiva", dt.strftime("%d-%b").lower()


def alertas(sesiones, ahora=None):
    """Motor de alertas (FR-004/FR-005): cada una trae la ACCIÓN recomendada."""
    ahora = ahora or datetime.datetime.now()
    lista = []
    limite = UMBRALES["limite_contexto"]
    activas = 0

    for s in sesiones.values():
        est, _ = estado_sesion(s["mtime"], ahora)
        if est == "activa" and not s.get("es_subagente"):
            activas += 1
        ratio = s["contexto_ultimo"] / limite if limite else 0
        nombre = s.get("chat", s.get("sid", "?"))
        if est == "activa" and ratio >= UMBRALES["contexto_crit"]:
            lista.append({
                "sev": "critical", "chat": nombre,
                "metrica": "contexto al %d%% del límite (%s tok)" % (
                    round(ratio * 100), format(s["contexto_ultimo"], ",")),
                "accion": "CIERRA ese chat y abre uno nuevo. El contexto vive en los "
                          "archivos del repo, no en la conversación.",
            })
        elif est == "activa" and ratio >= UMBRALES["contexto_warn"]:
            lista.append({
                "sev": "warning", "chat": nombre,
                "metrica": "contexto al %d%% del límite (%s tok)" % (
                    round(ratio * 100), format(s["contexto_ultimo"], ",")),
                "accion": "Usa /compact en ese chat antes de seguir; evita pegarle "
                          "archivos grandes.",
            })
        media = s["cr"] // s["turnos"] if s["turnos"] else 0
        if (s["turnos"] > UMBRALES["inflada_turnos_min"]
                and media > UMBRALES["inflada_media"]):
            lista.append({
                "sev": "serious" if est == "activa" else "warning",
                "chat": nombre,
                "metrica": "sesión inflada: %s tok/turno de contexto medio × %d turnos" % (
                    format(media, ","), s["turnos"]),
                "accion": ("Está pagando ese contexto EN CADA turno: /compact ya, o "
                           "ciérrala y abre sesión nueva por lote."
                           if est == "activa" else
                           "Ya está inactiva; lección: una sesión por lote de trabajo, "
                           "no una sesión eterna."),
            })

    if activas >= UMBRALES["max_activas"]:
        lista.append({
            "sev": "warning", "chat": "(global)",
            "metrica": "%d sesiones activas a la vez" % activas,
            "accion": "Cierra las que no estés usando: cada una retiene RAM y reparte "
                      "tu foco (y tu límite semanal).",
        })

    orden = {"critical": 0, "serious": 1, "warning": 2}
    lista.sort(key=lambda a: orden.get(a["sev"], 9))
    return lista


def resumen(dias=1, ahora=None, raiz=None, idx_titulos=None):
    """Ensamble JSON-serializable para la API (FR-002/FR-007)."""
    ahora = ahora or datetime.datetime.now()
    sesiones, tendencia, saltadas = recolectar(dias, ahora, raiz, idx_titulos)

    filas, tot = [], collections.Counter()
    for sid, s in sesiones.items():
        est, ultima = estado_sesion(s["mtime"], ahora)
        tokens = s["in"] + s["out"] + s["cw"] + s["cr"]
        for k in ("in", "out", "cw", "cr", "turnos"):
            tot[k] += s[k]
        filas.append({
            "sid": sid[:8], "chat": s["chat"], "proyecto": s.get("proyecto", ""),
            "es_subagente": s["es_subagente"], "estado": est, "ultima": ultima,
            "turnos": s["turnos"], "tokens": tokens, "entrada": s["in"],
            "salida": s["out"], "cache_w": s["cw"], "cache_r": s["cr"],
            "contexto_ultimo": s["contexto_ultimo"],
            "contexto_medio": s["cr"] // s["turnos"] if s["turnos"] else 0,
            "peso_usd": round(peso_usd(s), 2),
            "tokens_por_turno": tokens // s["turnos"] if s["turnos"] else 0,
        })
    filas.sort(key=lambda f: -f["peso_usd"])

    total_tokens = tot["in"] + tot["out"] + tot["cw"] + tot["cr"]
    serie = [
        {"fecha": f, "tokens": c["tokens"], "turnos": c["turnos"]}
        for f, c in sorted(tendencia.items())
    ]
    return {
        "generado": ahora.strftime("%H:%M:%S"),
        "fecha": ahora.date().isoformat(),
        "dias": dias,
        "lineas_saltadas": saltadas,
        "umbral_contexto": UMBRALES["limite_contexto"],
        "kpis": {
            "tokens": total_tokens,
            "turnos": tot["turnos"],
            "sesiones": len([f for f in filas if not f["es_subagente"]]),
            "activas": len([f for f in filas
                            if f["estado"] == "activa" and not f["es_subagente"]]),
            "pct_cache": round(tot["cr"] / total_tokens * 100, 1) if total_tokens else 0,
            "peso_usd": round(sum(f["peso_usd"] for f in filas), 2),
        },
        "tendencia": serie,
        "sesiones": filas,
        "alertas": alertas(sesiones, ahora),
    }

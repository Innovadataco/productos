#!/usr/bin/env python3
"""Agrega el boton «Volver a mapas» a los artefactos Archify de piweb.

Los HTML de los mapas se generan con Archify (fuente.json) y este script
agrega, justo antes de </body>, un enlace fijo de regreso a la portada
/arquitectura/. Idempotente: no duplica el boton si ya existe.

Uso: python3 agregar-boton-volver.py <archivo.html> [...]
"""
import sys
from pathlib import Path

BOTON = (
    '<a href="/arquitectura/" aria-label="Volver a la portada de mapas" '
    'style="position:fixed;top:14px;left:14px;z-index:2147483647;'
    'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;'
    'border-radius:999px;background:rgba(20,24,22,.55);color:#fff;'
    'font:600 13px/1 system-ui,-apple-system,\'Segoe UI\',sans-serif;'
    'text-decoration:none;backdrop-filter:blur(8px);'
    '-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.25);"'
    '>&#8592; Mapas</a>'
)
MARCA = 'href="/arquitectura/" aria-label="Volver a la portada de mapas"'


def inyectar(ruta: Path) -> str:
    html = ruta.read_text(encoding="utf-8")
    if MARCA in html:
        return "ya tenia boton"
    if "</body>" not in html:
        return "ERROR: sin </body>"
    ruta.write_text(html.replace("</body>", BOTON + "\n</body>", 1), encoding="utf-8")
    return "boton agregado"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    fallos = 0
    for arg in sys.argv[1:]:
        ruta = Path(arg)
        try:
            print(f"{ruta}: {inyectar(ruta)}")
        except OSError as e:
            print(f"{ruta}: ERROR: {e}")
            fallos += 1
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())

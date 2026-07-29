# AGENTS.md — 000-2026-MODELOS

## Naturaleza del producto
Herramienta **interna de gestión** (no producto de cliente). La mantiene **ZEUS**
directamente — excepción documentada al flujo ZEUS→ODIN, por orden del CEO (2026-07-29).
ODIN puede leerla como referencia; no la modifica sin instrucción de ZEUS.

## Reglas inquebrantables (constitución §1)
1. **Monitorear, nunca actuar** — solo handlers GET; jamás mata procesos ni toca sesiones.
2. **Nada sale de la Mac** — bind 127.0.0.1; cero peticiones salientes, cero CDNs.
3. **Cero dependencias** — Python stdlib + HTML/CSS/JS vanilla. Sin pip, sin npm, sin build.
4. **Solo lectura** fuera de esta carpeta.

## Operación
- Lanzar: `bin/modelos` → `http://127.0.0.1:8899` (puerto alternativo como argumento).
- Pruebas: `python3 -m unittest discover -s tests` — deben estar en verde antes de commitear.
- Umbrales de alerta: `UMBRALES` en `app/datos.py` (un solo lugar; documentados en el spec).

## Git
Rigen las reglas del monorepo (`../AGENTS.md`): trabajo en `feature/001-scaffolding`,
staging SOLO de `000-2026-MODELOS/...`, `main` recibe liberaciones auditadas.

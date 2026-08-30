# Evidencia §6 · SPEC-033 · vista `/operacion`

Capturas tomadas con `next build && next start` (NO `next dev`) + Playwright/Chromium headless, con `OPERACION_JSON_PATH` apuntando a una copia mutable del fixture real (`operacion.sample.json` · 3 equipos · 17 funcionalidades · 13 recorridos). F3C 2026-08-30 15:4x COT.

| Ítem | Archivo | Qué prueba | Resultado |
|---|---|---|---|
| (a) render light | `a-render-light.png` | 3 bloques con data real, colores distinguibles | ✅ crew + 2 paneles + banner + pie |
| (a) render dark | `a-render-dark.png` | tema oscuro del artefacto | ✅ |
| (b) archivo ausente | `b-archivo-ausente.png` | degradación clara, nunca blanco/stack, reloj sigue | ✅ `AvisoSinDatos` + reloj corriendo, sin ENOENT/stack |
| (c) reloj + fechas | (en a/b) | reloj Colombia corriendo + fechas `DD-MM-AAAA HH:MM` | ✅ t1≠t2 (2s), 80 fechas con el formato |
| (d) móvil | `d-movil.png` | no rompe en viewport 390px | ✅ `scrollWidth == innerWidth` (sin overflow del body; las tablas scrollean dentro de `.scroll`) |
| (e) TABLERO VIVO | `e1-tablero-vivo-antes.png` / `e2-tablero-vivo-despues.png` | re-lee el archivo en cada request (no foto del build) | ✅ ver abajo |

## (e) Tablero vivo · detalle

Con el server corriendo (mismo build, sin reiniciar), se editó el archivo apuntado por `OPERACION_JSON_PATH` y se recargó la página:

- **ANTES** (`e1`): Fábrica BI-2 = `ocupado` (rojo) · nota "congelada" · 13 recorridos (R-01 primero).
- **Edición en vivo**: BI-2 → `libre` + nota "LIBRE-EVIDENCIA-VIVA" · se insertó R-99 "FILA NUEVA EN VIVO" al inicio del array de recorridos.
- **DESPUÉS** (`e2`, tras `reload()` sin rebuild): BI-2 aparece **verde** con "LIBRE-EVIDENCIA-VIVA" · R-99 aparece **primera** en la tabla de recorridos.

Confirmado programáticamente: `nota_libre=True · fila_nueva=True · R-99=True`. La vista re-lee el JSON en cada request (`export const dynamic = "force-dynamic"`), no cachea. Es el corazón del brief: garantiza que cuando el CEO escriba el archivo en prod y recargue, verá el cambio.

## Nota de consola

Se observó 1 error 404 de consola: es el `favicon.ico` (la ruta `/operacion` no declara favicon propio · el layout root no lo cubre para esta ruta). No afecta el contenido ni el render del tablero. Fuera del alcance de SPEC-033 (tocar el layout/branding está prohibido).

# SPEC-369 · Poblador demo v2 — volumen con variedad real para BI

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: orden de Jelkin (destrabar a Kimi/BI)

## Para qué

Kimi necesita **volumen con variedad** para construir BI. El poblador v1
(002-PI-345) dejó ~2.000 reportes pero concentrados en **12 meses** y con un
único pool de textos genéricos: el clasificador veía siempre lo mismo y los
tableros no tenían de dónde sacar contraste.

## Qué crea el v2

~2.000 reportes con su `ClasificacionIA`, y:

- **Fechas repartidas en 2024, 2025 y 2026 hasta hoy.** Jelkin insistió en que
  hubiera densidad en todos los tramos, no solo en el último año. Reparto de la
  corrida con la semilla por defecto: **2024: 500 · 2025: 705 · 2026: 795**.
- **Relatos distintos y creíbles POR CATEGORÍA** (no un pool genérico), para que
  el clasificador clasifique distinto.
- **Mezcla NO uniforme**: las categorías sensibles pesan más. Reparto real:
  solicitud de encuentro 271 · solicitud de material 271 · compartimiento sexual
  262 · contacto insistente 228 · ciberacoso 210 · ofrecimiento de regalos 155 ·
  extorsión 127 · suplantación 101 · difusión no consentida 96 · happy slapping
  87 · stalking 59 · **spam 51** · doxing 42 · contenido generado por IA 40.
- **Países y ciudades variados** (CO, MX, AR, PE, CL, EC, UY) y **plataformas
  variadas**.
- Sube `operadores.cupo_maximo_default` a **500** (8 operadores × 500 = 4.000 de
  capacidad): la cola real ya no se tapa con el volumen demo.

## Cómo se revierte (lo que lo hace seguro)

Marca **propia y disjunta** del v1: ids con prefijo `demo2-`, NIT desde
900.000.051 (el v1 ocupa …001-050) y correos `+demo2-`.

**La propiedad clave, con test:** `"demo2-…"` NO empieza por `"demo-"` (el quinto
carácter es `2`, no `-`) y al revés tampoco. Por eso `borrar-demo-v2` limpia solo
lo suyo: **no roza el v1 ni los datos reales**. El borrador además aborta si
alguna vez los prefijos llegaran a solaparse.

## Candados

- `ClasificacionIA` se **inserta directa**: jamás pg-boss ni Ollama (R16).
- **Cero correos**: no se encola nada ni se toca ninguna preferencia.
- **Idempotente**: ids deterministas + `createMany skipDuplicates` → re-correr no
  duplica.
- **PII ficticia**: nicks y relatos inventados; el texto se cifra por el camino
  normal (`cifrarTextoReporte`).
- **Nunca fechas futuras** (dato sucio para BI) y hora en punto (G20).
- **Dry-run por defecto**: sin `--confirm` no escribe nada, solo muestra el reparto.

## Impacto en arquitectura: no

Scripts de datos de demostración; sin modelo, migración ni cambios de producto.

## Cómo se probó

- `demo-v2.test.ts` (11): prefijos disjuntos en las dos direcciones, NIT que no se
  pisa, ids deterministas, nunca fechas futuras, hora en punto, densidad en los
  tres años, relatos propios por categoría y sin repetirse, mezcla no uniforme
  (sensibles > spam, todas aparecen) y variedad de países.
- Dry-run ejecutado contra la BD de desarrollo: 2.000 filas con el reparto de
  arriba, sin escribir nada.

## Pendiente

La **carga en producción NO se ha ejecutado**: por candado del CEO se avisa antes
de correrla.

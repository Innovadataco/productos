# SPEC-491 · Mini-barrido de públicas de auth (recuperar + reportar): slate→neutro

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: auditoría de Diseño de las públicas. Hueco de «pantalla sin territorio»: recuperar/reportar quedaron fuera de los barridos.

## El arreglo
9 líneas de texto neutro (sin semántica): `recuperar/[token]/page.tsx:35,36,50,62` + `recuperar/page.tsx:11,12,21` + `reportar/page.tsx:30,33`. Mapeo: `text-slate-900` (títulos) → **`text-body`**; `text-slate-600/700` → **`.text-muted`**.

## Candado — `src/app/recuperar/publicas-auth-sin-crudo.candado.test.ts`
- 0 crudo slate/gray (patrón con direccionales) en `recuperar/**` y `reportar/page.tsx`. Muere por mutación.

## Impacto en arquitectura:
- Cierra las públicas de auth que ningún barrido de territorio cubría. Sin conducta (los flujos recuperar/reportar navegan igual).

## Referencias
Rama del lote desde `origin/main 94c0e8c8c`.

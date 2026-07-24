# Implementation Plan: Spec 091 — UX y privacidad consulta + seguimiento

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

La consulta pública pasa a POST (identificador en el cuerpo, nunca en la URL), el home gana el campo RPT hacia seguimiento transportado por sessionStorage, y el seguimiento celebra el estado con una animación de una sola corrida. Sin cambios de schema.

## Diseño

### US1 — POST /api/consulta
- `src/app/api/consulta/route.ts`: extraer la lógica compartida a un handler interno `resolverConsulta(identificador, request)`; `GET` (compat API) y `POST` (body JSON `{identificador}`, validado con el mismo Zod) delegan.
- Clientes: `HomePageClient.handleSearch` y `ConsultaPublicaClient` → `fetch("/api/consulta", { method: "POST", body: JSON.stringify({ identificador }) })` vía `useApi(url, options)`.
- Test de la route: POST devuelve el mismo contrato y la Request no lleva query string.

### US2 — Campo RPT en home
- `HomePageClient`: sección con input RPT-XXX → `sessionStorage.setItem("seguimiento.rpt", numero)` → `router.push("/seguimiento")`.
- `SeguimientoClient`: al montar, si no hay `?numero=`, lee `sessionStorage.getItem("seguimiento.rpt")`, lo limpia y autocompleta + autobusca (misma `handleSearch` existente).
- Test: el input del home existe y escribe sessionStorage; seguimiento lo consume.

### US3 — Animación de transición
- Componente `EstadoTransicion` en seguimiento: estado "En proceso" → spinner CSS; "Procesado" → secuencia de flechas (3 chevrons encendiéndose izq→der con delays) + check verde con `@keyframes` de rebote (scale 0→1.15→1). Clase `run-once` (animation-fill-mode: forwards, iteration-count: 1). Se renderiza al llegar `data`, una sola vez (no re-render en bucle).
- Sin librerías nuevas: CSS inline/Tailwind + `<style jsx>` o keyframes en el componente.

## Tests
- POST /api/consulta sin identificador en URL (nuevo `route.test.ts` caso).
- Home: campo RPT presente y flujo sessionStorage (component test).
- Seguimiento: lee sessionStorage cuando no hay query (component test).
- Animación: renderiza los 3 pasos y tiene iteration-count 1 (smoke test).

## Riesgos
| Riesgo | Mitigación |
|--------|------------|
| Romper consumidores GET de la API | GET se conserva intacto (misma lógica compartida) |
| sessionStorage no disponible (SSR) | Lectura solo en cliente tras mount, con fallback a query param |

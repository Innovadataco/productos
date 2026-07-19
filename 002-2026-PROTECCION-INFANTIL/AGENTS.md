# AGENTS.md — Producto 002 (Protección Infantil)

## Qué es
SaaS de reportes comunitarios de riesgos para menores (Innovadataco). Trabajas dentro de esta carpeta (`002-2026-PROTECCION-INFANTIL`), repo `Innovadataco/productos`, rama `feature/001-scaffolding`.
**Fase: DESARROLLO, no producción.** No desplegar a producción; eso lo decide el responsable.

## Entorno
- App: puerto `5005`. Acceso remoto (Tailscale) requiere levantar con `-H 0.0.0.0`.
- Postgres (Docker): contenedor `002-2026-proteccion-infantil-db-1`, puerto 5433, user `proteccion`, BD `proteccion_infantil`.
- Ollama: modelo `ornith:9b`.

## Comandos
- Build: `npm run build` · Tests: `npm run test` · Types: `npx tsc --noEmit` · Lint: `npm run lint` · E2E: `npm run test:e2e`
- **Reinicio/deploy limpio (usar SIEMPRE tras cada cambio): `./scripts/dev-restart.sh`** — hace rm -rf .next, build, mata app y workers viejos, levanta app (-H 0.0.0.0) + UN worker, healthcheck. Nunca dejar más de un worker.

## Metodología: Spec-Kit (Spec-Driven Development)
Flujo obligatorio por feature: **specify -> clarify -> plan -> tasks -> analyze -> implement**. Si no hay slash commands nativos, lee y ejecuta como instrucciones los archivos `.clinerules/workflows/speckit-*.md`. Respeta `.specify/memory/constitution.md`.
Cada spec vive en `specs/NNN-nombre/` con el MISMO set y formato que `specs/001-multi-role-auth-config/`: `spec.md` (User Stories con Priority + Acceptance Scenarios + Edge Cases; Functional Requirements "FR-XXX: El sistema DEBE..."; Success Criteria; Assumptions; sección Implementación al cerrar), `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` (si hay endpoints), `checklists/requirements.md`, `tasks.md` (fases + `TNNN [P]` con ruta de archivo, orden por dependencias, TDD donde aplique).

## Skills (usar cuando aporten valor)
- UI/UX (componentes, vistas, mapas): `/skill:ui-ux-pro-max`.
- Uso correcto de Kimi Code: `/skill:check-kimi-code-docs`.
- Cualquier skill instalada que aporte valor real a la tarea.

## Reglas de cierre (las 5, ninguna se salta)
1. Spec-Kit completo (todos los artefactos + checklist validado).
2. commit + push a `feature/001-scaffolding`: un commit por User Story + uno de docs, con evidencia (git log + archivos tocados).
3. Deploy limpio con `./scripts/dev-restart.sh`.
4. Probar con el `quickstart.md`.
5. Documentar: `cierre.md` + sección Implementación en `spec.md` + deuda técnica.

## Reglas de oro
- Migraciones SIEMPRE aditivas y NO destructivas. Nunca `prisma migrate reset` ni nada que borre datos.
- Nunca confiar en una build sin `rm -rf .next` antes (aparecen builds viejas).
- Un solo worker a la vez.
- No cerrar hasta completar TODAS las tareas del prompt y todos los artefactos.
- Reporte final CONCISO, sin gastar tokens.
- Tono NEUTRAL, sin voseo ("reporta/crea/verifica", no "reportá/creá/verificá").
- No modificar nunca el texto original de un reporte (posible evidencia).

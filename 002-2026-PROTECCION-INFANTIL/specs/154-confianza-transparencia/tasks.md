# Tareas: SPEC-154 — Confianza: transparencia, protocolo e historial

## T001 [P] Crear documentos fuente en `docs/rector/`
- Archivos: `docs/rector/transparencia.md`, `docs/rector/protocolo.md`, `docs/rector/compromiso.md`.
- Contenido mínimo: propósito del documento, alcance, compromisos y enlaces oficiales.

## T002 [P] Servicio de documentos de confianza
- Archivo: `src/lib/colegio/confianza-documentos.ts`.
- Allowlist cerrada de rutas; lector basado en `src/lib/docs/documentos.ts`.
- Tests unitarios básicos de allowlist.

## T003 [P] Servicio y endpoint de auditoría del colegio
- Archivos: `src/lib/colegio/confianza-auditoria.ts`, `src/app/api/colegio/confianza/auditoria/route.ts`.
- Filtro `colegioId` + `creadoEn >= NOW() - interval 'N days'`.
- Validación Zod de `dias` (1-90), paginación `page`/`pageSize`.
- Tests de integración.

## T004 [P] Endpoint de PDF del protocolo
- Archivo: `src/app/api/colegio/confianza/protocolo/pdf/route.ts`.
- Generar PDF a partir del Markdown de `protocolo.md`.
- Test de integración.

## T005 [P] UI `/dashboard/colegio/confianza`
- Archivo: `src/app/dashboard/colegio/confianza/page.tsx`.
- Selector de documento, renderizado Markdown, tabla de auditoría paginada, botón de PDF.

## T006 [P] Tests de integración y permisos
- Tests para SCHOOL_ADMIN, ADMIN 403, documentos allowlist, auditoría 90d.

## T007 [P] Regenerar línea base arquitectónica
- Ejecutar `npx tsx scripts/arch/generar-roles-capacidades.ts` y `generar-pantallas.ts`.

## T008 [P] Documentar cierre y README
- Actualizar `spec.md` a IMPLEMENTADO, completar `cierre.md`, README y `feature.json`.

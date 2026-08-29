# Plan: SPEC-154 — Confianza: transparencia, protocolo e historial

## Resumen de enfoque

Feature de solo lectura para `SCHOOL_ADMIN` que combina documentación institucional Markdown (transparencia/protocolo) con un historial de auditoría reciente del colegio. Se reutiliza el componente `Markdown` y el lector de documentos de SPEC-017, y se añade un servicio tenant-first sobre `AuditLog`.

## Decisiones clave

- **Allowlist cerrada** para documentos (`docs/rector/transparencia.md`, `protocolo.md`, `compromiso.md`) — mismo patrón de seguridad que `leerDocumento`.
- **Markdown seguro**: reutilizar componente existente; no se permite HTML crudo.
- **Auditoría 90 días**: query `AuditLog` filtrado por `colegioId` y `creadoEn >= NOW() - interval '90 days'`.
- **Sin cambios de modelo**: `AuditLog` ya tiene `colegioId` e índices.
- **PDF opcional**: generar desde el mismo Markdown del protocolo usando `@react-pdf/renderer` o `pdfmake`.

## Fases

1. **Documentos fuente**: crear `docs/rector/*.md` con contenido mínimo de transparencia, protocolo y compromiso.
2. **Backend de documentos**: servicio `src/lib/colegio/confianza-documentos.ts` con allowlist y lector.
3. **Backend de auditoría**: servicio `src/lib/colegio/confianza-auditoria.ts` + endpoint `GET /api/colegio/confianza/auditoria`.
4. **Backend PDF**: endpoint `GET /api/colegio/confianza/protocolo/pdf`.
5. **UI**: página `/dashboard/colegio/confianza/page.tsx` con selector de documento, renderizado Markdown y tabla de auditoría.
6. **Tests**: integración para documentos, auditoría y 403.
7. **Arquitectura**: regenerar `docs/architecture/02-roles-capacidades.md` y `03-pantallas.md`.
8. **Cierre**: actualizar `spec.md`, `cierre.md`, README y `feature.json`.

## Riesgos y mitigaciones

- **Riesgo**: documentos Markdown contienen contenido sensible. **Mitigación**: allowlist cerrada y renderizado sin HTML crudo.
- **Riesgo**: auditoría expone PII. **Mitigación**: filtrar por colegio, limitar a 90 días, no exponer IPs en claro ni textos de reportes.

## Dependencias

- SPEC-017 (visor Markdown) implementado.
- `AuditLog` con `colegioId` disponible (ya en schema).

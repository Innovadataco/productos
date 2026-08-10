# Research: SPEC-154 — Confianza

## Capacidades existentes reutilizables

- `src/lib/docs/markdown.tsx`: renderizador Markdown seguro (SPEC-017).
- `src/lib/docs/documentos.ts`: lector con allowlist y protección contra path traversal.
- `src/lib/audit.ts`: helper `logAudit` y modelo `AuditLog` con `colegioId`.
- `src/lib/permisos-modulos.ts`: verificación de acceso a módulos (`colegios_gestion`).
- `@react-pdf/renderer` y `pdfmake`: dependencias disponibles para PDF.

## Patrones a seguir

- SPEC-153: endpoint JSON + endpoint Excel + UI en `/dashboard/colegio/analisis/comparativa`.
- SPEC-017: viewer de documentos Markdown con allowlist.
- SPEC-134: consultas tenant-first (`colegioId` obligatorio).

## Hallazgos

- `AuditLog` tiene índice por `colegioId` y `creadoEn`, por lo que la consulta por rango de fechas es eficiente.
- No existe `docs/rector/`; se creará como parte de la implementación.
- El renderizador Markdown soporta encabezados, párrafos, listas, tablas, código, negrita, cursiva, enlaces y citas; cualquier otro formato se ignora o renderiza como texto.

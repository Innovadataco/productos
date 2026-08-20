# Checklist de requisitos: SPEC-190 — Deploy ejecuta seed idempotente

## Requisitos funcionales

- [ ] FR-001: `scripts/deploy-prod.sh` ejecuta el seed después de migraciones y antes del sync de módulos.
- [ ] FR-002: El seed es idempotente respecto a valores custom del CEO.
- [ ] FR-003: Cada `update: { ... }` en el seed tiene comentario justificativo.
- [ ] FR-004: Parámetros viejos usan `update: {}`.
- [ ] FR-005: Parámetros nuevos/cambiados por SPEC usan `update: { valor, descripcion }` con justificación.
- [ ] FR-006: Logs del seed identifican secciones terminadas.
- [ ] FR-007: Sin cambios de código de app.
- [ ] FR-008: Sin tocar `src/lib/ai/**`.

## Criterios de éxito

- [ ] SC-001: Deploy incluye seed.
- [ ] SC-002: Doble deploy no pisa custom.
- [ ] SC-003: Parámetro faltante se crea.
- [ ] SC-004: Comentarios justificativos presentes.
- [ ] SC-005: Gate local verde.

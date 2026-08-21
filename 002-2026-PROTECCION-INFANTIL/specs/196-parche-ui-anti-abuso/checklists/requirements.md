# Requirements Checklist — SPEC-196

- [ ] I-83 · Nota se limpia al cambiar escenario.
- [ ] I-84 · Historial muestra columna ID truncado y copiar.
- [ ] I-85 · Array de identificadores priorizado sobre campo único.
- [ ] I-86a · Bloquear IP acepta IP en claro; backend hashea SHA-256.
- [ ] I-86b · Desbloquear requiere motivo ≥20 chars; registra `IP_DESBLOQUEADA_MANUAL`.
- [ ] Migración aditiva de enum `AccionAudit`.
- [ ] Tests de integración para I-85, I-86a, I-86b.
- [ ] Gate local completo verde.
- [ ] CI 6/6 verde.

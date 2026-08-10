# Checklist de requisitos: SPEC-160

## Volumen y roles

- [ ] FR-001: 5 colegios con tenant y SCHOOL_ADMIN.
- [ ] FR-002: 10 cursos por colegio.
- [ ] FR-003: 20 estudiantes por curso, ≥5 identificadores cada uno.
- [ ] FR-004: acudientes para estudiantes.
- [ ] FR-005: ≥10 OPERADOR + 1 COMITE_VALIDACION.
- [ ] FR-006: ≥50 PARENT, algunos con círculo de confianza.

## Reportes y motor

- [ ] FR-007: reportes anónimos y autenticados con fechas escalonadas en 6 meses.
- [ ] FR-008: mezcla de categorías/gravedades incluyendo SPAM/OTRO.
- [ ] FR-009: procesamiento con motor real, corrida resumible.
- [ ] FR-010: asignación a operadores según lógica real.
- [ ] FR-011: escalamiento operador→comité ejercido.

## Seguridad y email

- [ ] FR-012: todos los usuarios demo usan subdirecciones de `soporte@innovadataco.com`.
- [ ] FR-013: hoja de credenciales generada.
- [ ] FR-014: todo dato demo marcado inequívocamente.
- [ ] FR-015: purga extiende todo el árbol demo.
- [ ] FR-016: purga idempotente y deja BD idéntica.
- [ ] FR-017: avisos solo a `soporte+…@innovadataco.com`.
- [ ] FR-018: sin tocar motor, Gesmovil ni config real.
- [ ] FR-019: reutilizar scripts y seed existentes.

## Gate de calidad

- [ ] `npx tsc --noEmit` sin errores.
- [ ] `npm run lint` sin errores.
- [ ] Purga probada en snapshot/clon de prod.
- [ ] Conteos demo a cero tras purga.
- [ ] Datos reales intactos tras purga.

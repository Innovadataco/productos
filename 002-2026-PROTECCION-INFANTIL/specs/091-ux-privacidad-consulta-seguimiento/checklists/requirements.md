# Checklist de requisitos — Spec 091

**Spec**: `specs/091-ux-privacidad-consulta-seguimiento/spec.md` · **Verificado**: 2026-07-24

- [x] US1: `POST /api/consulta` con el identificador en el cuerpo (test: Request sin query string, mismo contrato).
- [x] US1: clientes web (home y `/consulta`) usan POST; URL del navegador limpia (test).
- [x] US2: campo "Consultar el estado de mi reporte" en el home (test).
- [x] US2: RPT transportado por sessionStorage, limpio tras leer; sin `?numero=` en la URL (test).
- [x] US3: animación spinner→flechas→check con rebote, una sola corrida (test: `1 forwards`, sin `infinite`).
- [x] Nada rompe 089/090 (suite completa como regresión).
- [x] Sin cambios de schema.
- [x] Staging explícito solo del 002.
- [ ] ACTA-VALIDACION de ZEUS — PENDIENTE.

# SPEC-380 (PR A) · Tasks

- [X] T001 Diagnóstico 15v5: `SolicitudComite`, `informes-caso.ts:193` (resolucion ya usada), `CasoDetalle`, rutas del comité.
- [X] T002 Reportar diagnóstico + split A/B al CEO antes de codificar.
- [X] T003 Migración `20260902230000_spec_380_analisis_comite` (5 columnas + 2 FKs + 1 índice + 2 valores enum).
- [X] T004 Extender `SolicitudComite` en `schema.prisma` con relaciones backref en `Usuario`.
- [X] T005 `PUT/GET /api/colegio/comite/solicitudes/[id]/analisis` (edita comité; lee rector).
- [X] T006 `POST /api/colegio/comite/solicitudes/[id]/recomendar-informe` (marca + audit + aviso).
- [X] T007 Helper `enviarRecomendacionInformeAlRector` en `email-colegio.ts`.
- [X] T008 Plantillas EMAIL + IN_APP en `prisma/seed.ts` (patrón anti-I-100 con `update: {}`).
- [X] T009 Reglas hermanas (email opcional + in_app obligatoria).
- [X] T010 UI `CasoDetalle`: sección Análisis del comité + Recomendar, tarjeta ámbar (nunca rojo).
- [X] T011 Test integration `analisis/route.test.ts` (6 casos).
- [X] T012 Test integration `recomendar-informe/route.test.ts` (4 casos, incluye "motor caído no rompe").
- [X] T013 Gate: tsc + integration verdes.
- [X] T014 Regen baseline arquitectura (aparecen las 2 rutas nuevas).
- [ ] T015 [Post-merge, CEO] verificación en vivo: comité guarda análisis, recomienda, rector recibe la in-app (verifica en la fila `Notificacion` con `canal=IN_APP`) y ve la tarjeta ámbar en el caso.

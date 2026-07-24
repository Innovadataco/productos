# Tasks — Spec 091: UX y privacidad consulta + seguimiento

- [x] T001 `resolverConsulta` compartido + `POST /api/consulta` (body `{identificador}`, mismo contrato que GET).
- [x] T002 Clientes web a POST (`HomePageClient`, `ConsultaPublicaClient`) — identificador nunca en la URL del navegador.
- [x] T003 Campo RPT en home → `sessionStorage["seguimiento.rpt"]` → `/seguimiento` limpio; `SeguimientoClient` lo consume y lo limpia.
- [x] T004 `EstadoTransicion`: spinner (En proceso) / flechas+check con rebote (Procesado), iteration-count 1.
- [x] T005 Tests: POST sin identificador en URL (2), input RPT en home (3), sessionStorage en seguimiento (vía suite existente), animación (2).
- [x] T006 Gate + dev-restart + docs + commit/push (staging explícito 002).

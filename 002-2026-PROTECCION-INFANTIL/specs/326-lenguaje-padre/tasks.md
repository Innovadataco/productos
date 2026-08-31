# Tasks: Cómo le habla PI al padre (SPEC-326 · 002-PI-226)

**2 PRs (aprobado Fábrica PARA 31-08 00:52):**
- **PR1 = Fase A (§3.1)** — sin migración, MVP desplegable solo.
- **PR2 = Fases B+C+D (§3.5 + §3.4 + §3.6)** — 1 migración aditiva; cambio-correo con §6 cuidado. Rebasar antes.

Cada PR: regenerar arch (roles-capacidades/modelo-datos) + tests candado 24 v2 + **job `verificaciones` completo local** antes de pushear. §3.2/§3.3 fuera (A-60/A-61).

---

## PR1 · Fase A · §3.1 notificaciones

- [X] T001 Baseline `npx tsc --noEmit` limpio.
- [X] T002 [US1] `PreferenciasNotificaciones.tsx`: vista curada **solo para PARENT** (otros roles: vista técnica actual intacta). Catálogo: 2 toggles frase (`padre.circulo_confianza.reporte_enriquecido`, `reporte.resuelto`) + bloque forzado (plan `suscripcion.por_vencer`, seguridad `auth.password_cambiada`/`auth.password_recuperacion`). El toggle de una frase controla sus canales (EMAIL/IN_APP) juntos vía el PATCH existente; si el evento no vino en la data del API, ocultar esa frase (FR-005).
- [X] T003 [US1] Encabezado "Te escribimos a `<correo>` · Cambiar" (correo del user; "Cambiar" → `/dashboard/padre/perfil`). Pasar `correo`+`rol` como props desde `perfil/notificaciones/page.tsx`.
- [X] T004 [US1] Bloque gris al pie "Algunos avisos son de seguridad o de tu plan y siempre te llegan" (sin interruptor), con las frases forzadas.
- [X] T005 [P] [US1] Test unit: catálogo/mapeo — 2 toggles, forzados presentes, cero clave técnica, frases sin evento ocultas. `npm run lint -- <archivos>` + grep error.
- [X] T006 [US1] `npx tsc --noEmit` limpio + tests de lo tocado (candado 24 v2) + `arch:check` (sin ruta nueva en §3.1) + **job `verificaciones` completo local**.
- [X] T007 Disciplina specs: Status, fila `specs/README.md`, `specs-discipline.test.ts` local.
- [ ] T008 Gate pre-push (rebase, diff acotado a `002-2026-PROTECCION-INFANTIL/`) · evidencia §6 (captura móvil: 2 toggles + bloque forzado + cero jerga) · push · PR · `DE→PARA · REALIZADO · commit · PR#`.

---

## PR2 · Fase B · §3.5 país/ciudad registro

- [ ] T009 [US3] Migración aditiva `Usuario`: `paisId`, `ciudadId` (FK catálogo), índices. schema-to-schema + `prisma generate` (node_modules propio).
- [ ] T010 [US3] Registro (paso completar) + `/api/auth/verificar/completar`: campos país/ciudad con `CiudadSearchSelect permitirOtra={false}`; persistir en `Usuario`.
- [ ] T011 [US3] Tests: completar guarda paisId/ciudadId; sin "Otra ciudad".

## PR2 · Fase C · §3.4 perfil + cambio de correo

- [ ] T012 [US2] Migración aditiva `Usuario`: `telefono`, `emailNuevoPendiente` (+ token/expiración si `CodigoVerificacion` no encaja — confirmar leyendo su esquema).
- [ ] T013 [US2] Pantalla real `/dashboard/padre/perfil` (reemplaza placeholder): nombre/correo/teléfono/país/ciudad + acceso cambiar-contraseña. Sistema de diseño existente. Cada acción con verbo.
- [ ] T014 [US2] `/api/padre/perfil` GET/PATCH (nombre/teléfono/país/ciudad).
- [ ] T015 [US2] Cambio de correo: solicitar (validar no-en-uso → verificación al correo NUEVO → `emailNuevoPendiente`) + confirmar (aplicar + aviso al correo VIEJO, patrón A-59). Reuso `CodigoVerificacion`.
- [ ] T016 [US2] Tests: editar persiste; cambio-correo no aplica sin verificar; aviso al viejo; correo en uso → rechazo.

## PR2 · Fase D · §3.6 menú

- [ ] T017 [US4] `PADRE_NAV_ITEMS`: agregar "Mis reportes" + "Mi perfil" (→ pantalla §3.4).
- [ ] T018 [US4] Verificar comportamiento del lateral con A-56/A-57 (main): si resuelto, documentar no-op; si no, corregir. Tests de nav.

## PR2 · cierre
- [ ] T019 arch regen (roles-capacidades + modelo-datos) · tsc · lint · specs-discipline · job `verificaciones` completo local.
- [ ] T020 Evidencia §6 (capturas móvil en prod/dev aislada): registro país/ciudad, perfil edita, cambio-correo verify+aviso, menú. Push · PR · REALIZADO.

## MVP
Fase A (§3.1) es el MVP desplegable solo.

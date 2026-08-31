# SPEC-333 · La regla de notificación distingue el rol (I-223) · 002-PI-233 · A-63

**Status**: IMPLEMENTADO
**Radicado**: 002-PI-233 · A-63 · cierra I-223 · Prioridad 🟠 arquitectura · asume SPEC-330 desplegado
**Impacto en arquitectura:** cambia la identidad única de `NotificacionRegla` (`@@unique` incluye `rol`), migración que des-colapsa + re-seed idempotente, y hace al motor de notificaciones consciente del rol del destinatario (filtra reglas por rol cuando un evento tiene reglas de varios roles). No toca el motor de IA.

## Problema (verificado en fuente)

`NotificacionRegla` tiene columna `rol` (`schema.prisma:2534`) pero su identidad la ignora: `@@unique([evento, canal, plantillaClave])` (dedup SPEC-247). Al sembrar, dos reglas del mismo `(evento, canal, plantillaClave)` con **rol distinto** colisionan → gana la última (upsert last-write-wins); la del otro rol no persiste. La pantalla de preferencias deriva los toggles por rol (`preferencias.ts:36-37` `filter(r => r.rol === rol)`) → rectores (`SCHOOL_ADMIN`), comité y operador ven **menos toggles de los que les corresponden** (o ninguno). El motor no pierde envíos (dispara por evento), pero el usuario pierde el control (apagar/prender).

## Decisión de diseño (con el seed en la mano)

**Opción A — identidad `[evento, canal, plantillaClave, rol]`.** Elegida.
**Evidencia del seed:** cada `(evento, canal)` que colisiona usa **una sola plantilla, de texto rol-genérico** (`Hola {{nombre}}, …`): `suscripcion.por_vencer/en_gracia/cortada` (seed ~3140-3177), `caso.asignado` (~3206), `referido.registrado/recompensa/tope_anual` (~3235-3269). Ningún texto es rol-específico. Como el texto es el mismo por rol, **A basta**: se mete `rol` en la identidad y los roles siguen compartiendo su plantilla. La Opción B (plantilla por rol) duplicaría texto idéntico sin beneficio; si algún día el texto diverge por rol (A-62 "lenguaje de padre") se migra a B **encima** de A.

## Hallazgo que amplía el alcance (candado 26 · aprobado por CEO)

Des-colapsar sin más **rompe la conducta del motor**: `programar` toma `findByEventoActivo(evento)` (`notificacion-regla.ts:43-44`, **sin filtro de rol**) y aplica CADA regla a CADA destinatario; los destinatarios no llevan rol. Hoy hay 1 regla por `(evento, canal)` → 1 envío. Al des-colapsar (N roles):
- Eventos `+0m` (`referido.*`, `caso.asignado`): el reemplazo solo cancela ENCOLADA **futuras** (`enviarEn > now`), no las inmediatas → **doble envío**.
- `suscripcion.por_vencer`: offsets distintos por rol (rector `-5d` vs padre `-1d`) → el offset aplicado dependería del orden de las reglas.

Por eso A-63 incluye hacer el **motor consciente del rol del destinatario**. Preserva la conducta del padre (1 envío, `-1d`) y es la única forma de des-colapsar sin duplicar.

## Requisitos funcionales

- **FR-001** La identidad de `NotificacionRegla` pasa a `@@unique([evento, canal, plantillaClave, rol])`. Migración schema-a-schema (drop del índice viejo + create del nuevo).
- **FR-002** El seed renombra las 11 filas `rol: "RECTOR_COLEGIO"` → `"SCHOOL_ADMIN"` (enum) — SPEC-330 fue solo padre; sin esto la regla del rector nunca matchea el filtro enum.
- **FR-003** `upsertNotificacionRegla` (seed) usa la clave compuesta nueva (`evento_canal_plantillaClave_rol`) → cada rol conserva su regla (des-colapso). Idempotente `update:{}` (no pisa ediciones del admin).
- **FR-004** Migración de datos que **des-colapsa**: tras el nuevo índice, el re-seed re-crea las filas por rol que se habían colapsado. Verificable en BD: el conteo de reglas por `(evento, canal)` crece a N (una por rol) donde antes había 1.
- **FR-005** El motor filtra reglas por el rol del destinatario **sólo cuando el evento tiene reglas de más de un rol**. Rol efectivo del destinatario = `destinatario.rol` explícito, si no `Usuario.rol` resuelto de `usuarioId`. Para eventos de un solo rol, comportamiento idéntico al actual (cero cambio).
- **FR-006** Los callers de los eventos multi-rol pasan `rol` por destinatario (necesario por los destinatarios **email-only**: representante legal del colegio, admins). Enumerados en el plan (candado 22v5).
- **FR-007** Preferencias: `SCHOOL_ADMIN`, `COMITE_VALIDACION`/`COMITE_CONVIVENCIA` y `OPERADOR` ven sus toggles (antes ninguno/menos).
- **FR-008** Conducta del padre intacta: un padre (`PARENT`) sigue recibiendo `suscripcion.por_vencer` una vez, a `-1d`. Cero envíos duplicados en `+0m`.

## Escenarios (User Stories)

- **US1 (P1) — El rector controla sus preferencias.** Como `SCHOOL_ADMIN`, veo y activo/desactivo mis toggles (`suscripcion.*`). **Contraprueba:** antes, ninguno aparece.
- **US2 (P1) — El motor no duplica ni cambia la conducta del padre.** `suscripcion.por_vencer` para un padre → 1 envío `-1d`; `referido.registrado` a colegio+padre → cada destinatario 1 envío por su rol, sin duplicados.
- **US3 (P2) — Comité y operador ven sus toggles** de `caso.asignado`.

## Success Criteria

- **SC-001** BD antes/después: `SELECT evento, canal, count(*) ... GROUP BY` muestra el des-colapso (N por rol donde había 1). Evidencia negativa del colapso previo.
- **SC-002** Test 24v2: padre 1 envío `-1d`; rector su regla `-5d`; email-only representante → `SCHOOL_ADMIN`; **cero duplicados** en `+0m`. `email.migracion.test.ts` verde (alcance obligatorio).
- **SC-003** Preferencias por rol (SCHOOL_ADMIN/COMITE/OPERADOR) devuelven sus grupos — verificado en test, no supuesto.
- **SC-004** Job `verificaciones` completo + `specs-discipline` verdes; el CI valida el set combinado de migraciones.

## Fuera de alcance

- Plantillas por rol (Opción B) — sólo si el texto diverge; hoy no.
- `src/lib/ai/**` (motor IA) — intocable.
- El rename del padre (`"PADRE"`→`"PARENT"`) — ya hecho en SPEC-330.

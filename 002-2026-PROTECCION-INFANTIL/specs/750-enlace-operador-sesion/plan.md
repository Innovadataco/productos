# Plan técnico — SPEC-750

> Compuerta §4: este plan se aprueba ANTES de `/speckit.tasks` → `implement`. Se LEE el esquema de SPEC-758; no se toca.

## Anclajes medidos (código real, `96dfd4f2a`)

- `src/lib/profesional/calendario/calendario.service.ts` — `calendarioDelProfesional` arma `BloqueCalendario` con `familia` (nombre padre), `relato` (`presentacion`) y `contactoEmail`. La query `FranjaDisponibleRepository.listarConSolicitud` incluye `padreUsuario`.
- `src/lib/operadores/asignador.ts` — `asignarOperadorAReporte` (para REPORTES), estrategia `ponderado_carga_inversa`/`aleatorio_puro`, cuenta cantidad; **sin noción de hora**.
- `SolicitudCita` (SPEC-758): `enlaceReunion?`, `enlaceOperadorId?` (FK Usuario, SetNull), `enlacePublicadoEn?`. Comentario: `enlaceOperadorId` NO es registro de responsabilidad.
- `src/app/api/padre/citas/[id]/reprogramar/route.ts` y `.../reasignar/route.ts` — `data: conRelaciones ? toCitaParaPadre(conRelaciones) : nueva` (fallback crudo).
- `AuditLog.metadatos` (Json) **se replica a `bi_replica`** (`scripts/limpieza/_common.ts:88`).

## Decisiones de diseño (por pieza)

### 1. Calendario del operador — MISMA pantalla, DTO propio (FR-001/002 · C-a)
- **Nuevo servicio** `calendarioDelOperador(usuarioId, ahora)` en `src/lib/operadores/` (o `calendario-operador.service.ts`), que consulta las citas cuyo `enlaceOperadorId === usuarioId` en la ventana, y arma un **`BloqueCalendarioOperador`** cuyo TIPO no tiene `familia`/`relato`/`contactoEmail`.
- **Query con `select` explícito** que **no trae `padreUsuario`** (imposibilidad estructural: el dato no se carga, no se «oculta»). Lleva: fecha/horas/duración/modalidad/estado, `profesional.nombreVisible`, id corto de cita, `enlaceReunion`/`enlacePublicadoEn`.
- **Reusar el componente** `CalendarioProfesional.tsx` (o extraer la parte visual común) con el DTO del operador.
- **Candado de reserva** (unit, patrón `dto-reserva.candado.test.ts`): con `familia`/`relato`/`contactoEmail` poblados en la fuente, el DTO del operador no los contiene + control positivo de que la fuente los trae.

### 2. Asignación con simultaneidad (FR-003/004 · C-b)
- **Nueva función** `asignarOperadorACita(solicitudId, tx?)` en `src/lib/operadores/asignador-citas.ts` (hermana de `asignador.ts`; reusa la estrategia de menor carga para el desempate).
- **Filtro de simultaneidad**: candidatos = operadores (rol OPERADOR con módulo `sesiones_operador`) **sin** ninguna cita asignada cuya ventana `[franja.inicio, franja.fin)` se solape con la de la cita nueva. Solape SQL: `otra.franja.inicio < nueva.fin AND otra.franja.fin > nueva.inicio` (comparación en UTC), sobre citas en estado vivo.
- **Persistencia**: el operador elegido se guarda en `enlaceOperadorId`. Sin candidato libre → queda `null` (sin asignar).
- **Disparador**: al confirmarse la cita (donde hoy vive el flujo de confirmación) **y** un barrido de reconciliación para las sin asignar (reusa el patrón `reconciliar-huerfanos`). *(Punto a afinar en tasks; propongo: asignar en confirmación + barrido de respaldo.)*
- **Capacidad al admin (FR-004)**: superficie que lista las citas CONFIRMADAS con `enlaceOperadorId === null` (y las Atrasadas), en ámbar. → **[NEEDS CLARIFICATION]** widget nuevo vs reusar `operadores/asignar`.
- **Candado** (integración): asignar a operador ocupado en la ventana → rechazo; ventana libre → asigna (control positivo). Regla de oro: si un test existente del asignador de reportes se pone rojo, es **hallazgo**, no se reconcilia en silencio.

### 3. Límites [NORMA] en la pantalla (FR-008)
- Render de los límites desde una constante en el módulo del operador. **[NEEDS CLARIFICATION · Diseño/legal]** la copy exacta (FORMA §6 disponible; GUION v0.1 es borrador [ABOGADO]). Estructura lista; strings pendientes de confirmación — **no invento copy legal**.

### 4. Publicación y validación del enlace (FR-005/006/007)
- **Ruta** `POST /api/operador/citas/[id]/enlace` (guardia OPERADOR + dueño de la asignación). Zod + validación servidor: **solo `https:`** (via `URL`), rechazo si contiene marcado HTML; nunca se interpreta como HTML (se guarda como texto, el render escapa). Setea `enlaceReunion` + `enlacePublicadoEn = now()`.
- **Sin correo** (no hay correo del padre; y se reenvía). **Sin** campo/copy de caducidad (FR-007).
- **Derivación de visibilidad** (FR-006): helper puro `enlaceVisibleParaCita(estado, franjaFin, now)` (oculto pasada la hora). Se usa en el consumidor; las **pantallas** de padre/profesional que lo muestran son FUERA de alcance — el helper se entrega y se testea, no se cablea a esas pantallas acá.

### 5. Registro del HECHO (FR-009/010 · C-c)
- **Vía `AuditLog`** (append-only existente) con `metadatos` = `{ tipo: "SESION_HECHO", citaId, parte, protocoloVersion, ingresoEn }` — **SIN URL**. Discriminador `metadatos.tipo` (evita migración de enum) **o** valores nuevos de `AccionAudit` (migración, D-121) → **decisión de la compuerta** (recomiendo el discriminador para no tocar schema).
- **[NEEDS CLARIFICATION]** fuente/valor de `protocoloVersion` (hash+fecha del GUION versionado).
- **Candado** (integración): con `enlaceReunion` poblado, correr la convocatoria/registro → la URL **no** aparece en ningún `AuditLog.metadatos` (barrido real de la fila). Es el candado que Datos va a medir.

### 6. Módulo y guardia (FR-012)
- Módulo `sesiones_operador` concedido a OPERADOR (seed de grants + `ModuloPermisible`) y guardia de página propia (patrón `proxy.ts`/routing). Verificar que no quede «solo-NAV» (candado `permisos-modulo-sin-superficie`).

### 7. Fallback DTO de reasignar/reprogramar (FR-011 · C-d)
- En ambas rutas, el `: nueva` crudo pasa a **fail-closed**: si `conRelaciones` es null, re-cargar o devolver un DTO seguro; **nunca** el modelo crudo (que ahora puede traer el enlace).
- **FR-013**: decidir y ESCRIBIR si `pagos/cita/pendientes` y `pagos/citas-vencidas` (admin) proyectan o aceptan la exposición interna del enlace.

## Plan de pruebas

- **Unit (sin BD)**: reserva del DTO del operador (C-a); selección con simultaneidad (función pura de solape); validación de URL (https/no-HTML); `enlaceVisibleParaCita`; builder del HECHO (no-url).
- **Integración (BD)**: asignar a operador ocupado → rechazo + control positivo (C-b); calendario del operador sin PII con los 3 campos poblados (C-a end-to-end); HECHO sin URL en `AuditLog` (C-c); fallback de reasignar/reprogramar por DTO (C-d).
- **Gate**: `npm run test:unit` COMPLETO antes del push (a Dev-1 le rebotó un guardián que solo sale con el job entero) + tsc + eslint + arch:check.

## Riesgos / notas

- El esquema de 758 se LEE. Si falta `asignadoEn` u otro campo, se **pide** a Datos, no se agrega acá.
- `enlaceOperadorId` SetNull no es responsabilidad → la responsabilidad durable vive en el HECHO (no auditar sobre esa columna).
- Cambios de schema (grants/módulo, o enum AccionAudit si se elige) pasan por D-121.

## Compuerta

`§4 listo · PARO`. Espero aprobación del CEO (y respuestas a los 3 `[NEEDS CLARIFICATION]`) antes de `/speckit.tasks`.

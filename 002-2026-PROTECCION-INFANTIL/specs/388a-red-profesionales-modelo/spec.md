# SPEC-388a · Red de Profesionales · L1a — solo modelo y migración

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1) · **Origen**: brief A-75 §2 (radicado del CEO, aprobado por Jelkin 03-09-2026); adenda del CEO 04:32 y 04:50 (aviso Calidad: reprogramación como fila nueva).

## Para qué

Séptimo actor del producto: **el profesional (psicólogo verificado)**. L1a saca **solo la migración y el modelo Prisma** en un PR chico para destrabar a Dev Infra que ya arrancó L2 contra este modelo. Sin UI, sin endpoints, sin lógica.

L1a es la base sobre la que L1b (registro y perfil), L2 (verificación IDC) y L3 (directorio del padre) construyen en paralelo.

## Qué trae

### 1) `RolUsuario += PROFESIONAL`
Migración aditiva con `ADD VALUE IF NOT EXISTS`.

### 2) 4 enums nuevos
- `EstadoPerfilProfesional`: `BORRADOR` (candado CEO 04:32 — sin esto la cola de IDC se llena de fichas vacías) · `EN_REVISION` · `ACTIVO` · `RECHAZADO` · `VENCIDO` · `SUSPENDIDO`.
- `ResultadoVerificacion`: `APROBADO` · `RECHAZADO` · `MAS_INFORMACION`.
- `ModalidadCita`: `VIRTUAL` · `PRESENCIAL`.
- `UrgenciaSolicitud`: `ESTA_SEMANA` · `SIN_APURO`.
- `EstadoSolicitudCita`: los 8 del brief §2 + `REPROGRAMADA` (adenda 04:50 · aviso Calidad).

### 3) 5 modelos nuevos
- **`PerfilProfesional`** (1:1 con `Usuario`) con todos los campos de la §2. **NO se duplican** `fechaNacimiento`, `documentoTipo`, `documentoNumero` — se reusan de `Usuario` (candado CEO 04:32: «interno» se cumple en la capa DTO, no duplicando la tabla). Índice `[estado, ciudadId]` para el directorio abierto (L3).
- **`VerificacionProfesional`** — historial: `revisadoEn`, `checklist` (jsonb), `resultado`, `autorizacionArchivoUrl`, `venceEn` (= `revisadoEn + 4 meses`, Ley 2375/2024). Índices para el listado por profesional (desc) y el barrido del worker de aviso 30 días.
- **`FranjaDisponible`** — franjas sueltas del profesional (`modalidad`, `tomada`), 1:0..1 con `SolicitudCita`.
- **`SolicitudCita`** — con `venceEn` (48 h), `expedienteCompartidoId` opcional revocable, montos denormalizados (tarifa + servicio + total + porcentaje al momento del cobro) y — adenda 04:50 — `solicitudPreviaId` + `pagoHeredadoDeId` (autorreferencia opcional): la reprogramación es **fila nueva** que hereda el pago, no una transición. Índices para bandejas de padre/profesional y para el worker que devuelve a las 48 h y autocierra a los 5 días.
- **`EncuestaPrimeraCita`** — 1:1 con `SolicitudCita`, con `puntaje` (validación 1-5 en Zod al llenar, Postgres no restringe).

### 4) Placeholders de `Record<RolUsuario, …>`
El compilador exige entradas exhaustivas para `PROFESIONAL` en cinco lugares: `consentimiento/page.tsx`, `dashboard/perfil/notificaciones/page.tsx`, `e2e/helpers.ts` y dos journeys. Se agrega un placeholder mínimo en cada uno (destino `/` o cadena vacía), con un comentario que dice explícitamente que **L1b/L5 llenan los valores reales** — dejarlos vacíos ahora es intencional y no rompe ningún camino existente (el rol `PROFESIONAL` aún no puede loguearse).

## Candados

- **Migración aditiva**: `ADD VALUE IF NOT EXISTS`, `CREATE TYPE`, `CREATE TABLE`. Nada se borra ni se renombra. Idempotente.
- **Reuso deliberado con `Usuario`** para `fechaNacimiento` y `documentoTipo/documentoNumero`. Reflejado con comentarios en el schema y en la spec.
- **Autorización firmada NO va por `escudo-storage`** (público). El campo `autorizacionArchivoUrl` referencia un storage protegido; el servicio de storage lo implementa L1b con el patrón de informes/apelaciones.
- **Auto-relaciones `SolicitudCita`** (`solicitudPrevia`, `pagoHeredadoDe`) con `onDelete: SET NULL`: eliminar una solicitud no arrastra en cascada las que la referencian.
- **`EstadoPerfilProfesional.BORRADOR` es el default**, no `EN_REVISION`. Sin este candado la cola de IDC se llenaría de fichas vacías.

## Impacto en arquitectura: sí (mínimo)

Migración nueva (aditiva) en `prisma/migrations/`. Sin cambio de contrato HTTP (no hay endpoints todavía). `docs/architecture/01-modelo-datos.md` regenerado con los cinco modelos nuevos.

## Cómo se probó

- `npx prisma validate` — schema válido.
- `npx prisma generate` — cliente regenerado sin errores.
- `npx prisma migrate deploy` a la BD de test — la migración se aplicó limpia desde cero (`migrate reset --force --skip-seed`).
- `tsc --noEmit` limpio.
- `arch/tokens/locks/ratchets` verdes.
- Lint 0 errores en archivos tocados.
- Regresión de tests: **no se corre** en L1a — la superficie funcional no cambió (no hay endpoints ni componentes nuevos que probar); el CEO pidió PR chico para destrabar a Dev Infra. L1b vendrá con sus propios tests de registro.

## Pendiente

- L1b: registro del profesional, perfil, autorización firmada.
- L2: revisión IDC, checklist, `VerificacionProfesional`.
- L3: directorio abierto para el padre.

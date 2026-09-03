# SPEC-408 · Red de Apoyo · el Verificador admite al profesional y atiende incidentes

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 (`idc-32`) · **Origen**: brief A-75 v2.0 §9 + §5-bis (repo de gestión, commit `762b77f`, aprobado por Jelkin 03-09-2026 15:2x–15:0x). Contrato de rutas fijado por el CEO 03-09-2026 15:35 y 15:38.

## Para qué

El profesional carga sus documentos (SPEC-391) y queda en `EN_REVISION`. Sin este SPEC, IDC no tiene UI ni endpoints para admitir o devolver: la cola queda ciega y el registro nace muerto. Este SPEC cierra el ciclo con un rol interno dedicado (**VERIFICADOR**) y dos colas: solicitudes por revisar + incidentes de citas `SIN_CONFIRMAR`.

**§9 del brief manda sobre 1-8.** El recorrido cerrado dictado por Jelkin fija: revisión humana a ojo, los 4 requisitos parametrizables, observación obligatoria al rechazar, ciclo sin límite de intentos, y el candado H-2 de reserva legal (el profesional NO ve `resultado` ni `checklist`).

## Qué trae

### 1) Rol interno nuevo `VERIFICADOR`

- **Enum aditivo** `RolUsuario.VERIFICADOR` (migración `20260903140000_spec_408_verificador_rol` con `ADD VALUE IF NOT EXISTS` — lección I-277).
- Se registra en `INTERNAL_ROLES` (`proxy.ts`), en `homeForRole` (proxy) y en `homeParaRol` (cliente) → aterriza directo en `/dashboard/admin/verificacion`, su única cola.
- Grants: **un solo módulo** `admin_verificacion_profesionales` cubre las dos colas (decisión CEO 15:38 · lección I-278: un rol, una persona, un trabajo, un módulo).

### 2) Los 4 requisitos, sembrados parametrizables

- Parámetro `ParametroSistema.verificacion.requisitos` (JSON), seed idempotente (`update: {}` — orden permanente de Jelkin: nada quemado).
- Default: tarjeta profesional / antecedentes / cédula / otro documento de soporte.
- Editable desde el admin en el ConfigPanel (sección "Otros", categoría SYSTEM).
- Reader puro `leerRequisitosVerificacion()` con validación Zod + errores explícitos si el parámetro falta o el JSON está corrupto.

### 3) Cola 1 · Solicitudes por revisar

- **Pantalla:** `/dashboard/admin/verificacion` (gate `admin_verificacion_profesionales`).
- **API:** `GET /api/admin/verificacion-profesionales` — lista de perfiles `EN_REVISION`, campos mínimos (nombre, título, ciudad, especialidades, reintentos, esperando-desde). SIN `checklist`, SIN `resultado`, SIN URL de autorización.

### 4) Ficha del Verificador

- **Pantalla:** `/dashboard/admin/verificacion/[id]` — descarga de autorización + checklist por ítem (`CUMPLE`/`NO_CUMPLE`), observación aparece al elegir `NO_CUMPLE`, botón único cuya semántica cambia (`Aprobar` cuando todos CUMPLE, `Devolver con observaciones` cuando hay al menos uno NO_CUMPLE con observación). Aprobar queda **bloqueado si hay algún NO_CUMPLE**.
- **API:** `GET /api/admin/verificacion-profesionales/[id]` (audita `PROFESIONAL_VERIFICACION_CONSULTADO` cada apertura · brief §5).
- **API única de decisión:** `POST /api/admin/verificacion-profesionales/[id]/decidir` con `{ checklist: { <clave>: { estado, observacion } } }`. El service `decidir()` calcula el resultado del checklist:
  - Todos CUMPLE → `APROBADO` → perfil pasa a `ACTIVO` (entra al directorio).
  - Al menos uno NO_CUMPLE (con observación) → `RECHAZADO` → perfil vuelve a `BORRADOR` para corregir.
- En ambos casos: fila nueva en `VerificacionProfesional` con `venceEn = revisadoEn + 4 meses` (Ley 2375/2024, `calcularVenceEn` de SPEC-389), `checklist` completo, `notaInterna` con resumen, y `AuditLog` (`_APROBADA` / `_RECHAZADA`).
- **Email al profesional** en ambos casos, vía `enviarEmailNotificacion`. Best-effort: un problema del proveedor NO revierte la decisión (motor de notificaciones tiene su propio reintento).

### 5) Cola 2 · Incidentes de citas

- **Pantalla:** `/dashboard/admin/verificacion/incidentes` (mismo módulo).
- **API:** `GET /api/admin/verificacion-profesionales/incidentes` — lista de `SolicitudCita.SIN_CONFIRMAR`, sin `checklist`.
- La UI cablea `trazaCodigos: null` con un mensaje explícito de "pendiente de instrumentar". Los códigos de cita/expediente (brief §9 momento 6) llegan en un spec futuro; este PR NO los inventa.

### 6) Lado del profesional

- **Pantalla:** `/perfil-profesional/verificacion` — estado + observaciones del último rechazo + botón "Reenviar para verificación" (transición `BORRADOR → EN_REVISION`, sin límite de intentos).
- **API `GET /api/profesional/verificacion`**: devuelve `{ estadoPerfil, puedeReenviar, observaciones[] }`. **Cada observación es `{ requisito, observacion }` y nada más**. `resultado`, `checklist` estructurado, `revisadoPor`, `notaInterna`, `autorizacionArchivoUrl` NO salen — brief §5 y candado de Calidad.
- **API `POST /api/profesional/verificacion/reenviar`**: reabre la cola tras corregir. Audita `PROFESIONAL_VERIFICACION_MAS_INFO`.

### 7) Diseño

- Tokens de `globals.css`: `titular-h1`, `titular-seccion`, `microetiqueta`, `cifra`, `palabra-estado`.
- Tipografía: **Instrument Serif** para titulares, Instrument Sans para cuerpo, **DM Mono** para etiquetas técnicas y correos.
- **Iconos SVG de trazo** (check / X / download) escritos in-line en `FichaVerificacionClient` — sin librerías ni emoji.
- **Movimiento**: `anim-entrada` (0.6s cubic-bezier definido en globals) escalonado en las filas (`animationDelay: index*40ms`), `hover:scale-[1.005]` en tarjetas, `transition` en botones. El botón único cambia de color según semántica (emerald aprobar, amber devolver, slate bloqueado).
- Sticky action bar en la ficha para que el veredicto siempre esté al alcance.

### 8) Cadena de dependencias

Este PR cherry-pickea de `work/pi-SPEC-389-red-profesionales-l2` (Dev Infra) dos commits:
- `423977c9e` — spec base + `admin_verificacion_profesionales` en el catálogo + test de reserva legal en `prisma/seed-security.test.ts`.
- `a5b72d933` — helpers puros `vigencia.ts` + `cron-vencimiento.ts` + 24 tests candado (I-280 idempotencia, Ley 2375/2024, bisiesto).

Los reusamos, no los reescribimos (orden CEO: "reusalo, no lo reescribas").

## Candados

- **Reserva legal H-2** (Ley 1918/2018 · 2375/2024 · brief §5): `resultado`, `checklist` estructurado, `notaInterna`, `revisadoPor`, `autorizacionArchivoUrl` NUNCA salen por `/api/profesional/verificacion` ni por la pantalla del profesional. Test candado en `vista-profesional.test.ts` (busca claves prohibidas recursivamente en el shape declarado).
- **Sin observación no se puede rechazar** (brief §5-bis): el service tira 400 si un ítem `NO_CUMPLE` viene con observación vacía.
- **Aprobar bloqueado si hay algún NO_CUMPLE**: el service valida antes de mutar; la UI lo refleja deshabilitando el botón.
- **Checklist debe cubrir exactamente los requisitos configurados**: el service compara set enviado vs. set del parámetro; faltantes o sobrantes → 400. Un cliente stale o un intento raro no muta la BD.
- **Un solo módulo** (`admin_verificacion_profesionales`) cubre ambas colas: dos módulos duplicarían la superficie de falla en BD viva (lección I-278).
- **Auditoría en cada apertura** (`PROFESIONAL_VERIFICACION_CONSULTADO`) — trazabilidad legal exigida por §5.
- **Migración aditiva del enum** (`ADD VALUE IF NOT EXISTS`) en la misma migración que el código que lo emite (lección I-277).
- **Email fuera de la transacción**: la decisión clínica no se revierte por un problema del proveedor. El motor de notificaciones tiene su propio reintento.
- **`enviarEmailNotificacion` best-effort**: envuelto en try/catch — si truena, se loguea y la decisión sigue en pie.

## Verificación

- `npm run test:unit` completo verde (2165+ tests). 6 nuevos tests para SPEC-408 (`requisitos.test.ts` × 6, `vista-profesional.test.ts` × 4) + 24 heredados de SPEC-389.
- `npx tsc --noEmit` verde.
- `npm run arch:check` completo VERDE (a/b/c/d/d-bis/e/f) — 524 rutas × 6 roles alineadas.
- **Recorrido en producción (post-deploy)** — para Calidad:
  1. Loguearse como VERIFICADOR (usuario sembrado por Jelkin) → aterriza en `/dashboard/admin/verificacion`.
  2. Un profesional con perfil completo + autorización aparece en la cola con etiqueta de tiempo espera.
  3. Abrir la ficha: descargar autorización, marcar todo CUMPLE → Aprobar → perfil pasa a `ACTIVO`, aparece en directorio del padre.
  4. Otro profesional: marcar un ítem NO_CUMPLE sin observación → botón sigue bloqueado. Escribir observación → botón se habilita como "Devolver". Enviar → profesional recibe correo con la observación.
  5. El profesional entra a `/perfil-profesional/verificacion`, ve la observación (y NADA más), corrige y reenvía → vuelve a EN_REVISION.
  6. Segunda cola: `/dashboard/admin/verificacion/incidentes` lista las citas `SIN_CONFIRMAR` con la traza cableada.

## Impacto en arquitectura:

Introduce un rol interno nuevo (`VERIFICADOR`) sin abrir superficie: comparte área `/dashboard/admin/**` con ADMIN/OPERADOR/COMITE_VALIDACION pero por módulo (I-274 separación de poderes). El catálogo de módulos gana una sola clave; la BD viva puede activarlo por rol sin migración adicional.

La **lista de requisitos ya no vive en el código**: cambiar los 4 (o pasar a 5) no cuesta un despliegue. Cualquier otro dominio del proyecto que quiera revisiones humanas a ojo puede usar el mismo patrón (parámetro JSON + reader Zod + checklist como campo `Json` en la fila de decisión).

**El candado H-2 escrito en código y no solo en el DTO** (patrón que Dev Guardianes estableció en SPEC-392 · directorio del padre): la vista del profesional es una función pura que decide qué exponer; un test candado verifica el shape sin depender de la BD.

## Fuera de alcance

- **Los códigos de cita y expediente** (brief §9 momento 6): otro spec. La cola 2 los muestra como "pendiente de instrumentar" sin inventar datos.
- **Storage endpoint para servir la autorización** con auth+módulo: la URL viene del perfil (SPEC-391 la subió al patrón de storage protegido). Aquí se linkea directo; el gate lo hace la ruta de storage.
- **Worker cron efectivo** de vencimiento a 4 meses con aviso 30 días antes: `decidirAcciones` está lista (SPEC-389), un scheduler separado la va a llamar.
- **UI dedicada de edición de los 4 requisitos**: se editan hoy por el ConfigPanel genérico (sección "Otros"). Una UI dedicada puede llegar si el volumen de cambios lo justifica.
- **Segunda etapa del perfil del profesional** (carta de presentación, disponibilidad recurrente, aceptación de términos): brief §9 momento 3, otro SPEC (posiblemente L5).

## Referencias

- Brief A-75 v2.0 §9 y §5-bis · repo de gestión commit `762b77f`.
- SPEC-388a (modelo, mergeado) · SPEC-391 (registro, mergeado) · **SPEC-389 (helpers de vigencia + módulo · cherry-pick)** · SPEC-395 (cita).
- Ley 1918/2018 · Ley 2375/2024 · Corte C-407/2020.
- Lecciones aplicadas: **I-277** (enum + código en la misma migración), **I-278** (un módulo, no dos), **I-280** (idempotencia del recordatorio 30-días), **I-274** (separación de poderes).
- Worktree: `.worktrees/pi-SPEC-408` desde `origin/main d832ec3db`. Migración: `prisma/migrations/20260903140000_spec_408_verificador_rol/`.

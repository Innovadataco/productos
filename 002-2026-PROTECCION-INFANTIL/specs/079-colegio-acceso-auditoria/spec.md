# Spec 079 — Módulo Colegios: acceso institucional y auditoría del colegio

**Status**: `FINALIZADO` (pendiente ACTA-VALIDACION de ZEUS → `CERRADA`)  
**Rama**: `feature/001-scaffolding`  
**Fase del programa**: Saneamiento / Mejoras del módulo Colegios  
**Creado**: 2026-07-21  

## Contexto

El módulo Colegios ya tiene su fase de fundación (Spec 074) y fases de cursos/alumnos/identificadores (Spec 075), carga masiva (Spec 076), alertas (Spec 077) y estadísticas/PDF (Spec 078). Este spec cierra tres gaps operativos urgentes:

1. Bug de vigencia: un colegio creado hoy se bloquea por comparación de horas en `verificarVigenciaColegio`.
2. Gestión de acceso del colegio: el administrador no puede restablecer la contraseña ni reenviar credenciales al SCHOOL_ADMIN.
3. Auditoría del colegio: el SCHOOL_ADMIN no tiene visibilidad de las acciones COLEGIO_*.

## User Stories

### User Story 1 — Fix de vigencia (Priority: P1)

**Como** SCHOOL_ADMIN de un colegio creado hoy,  
**quiero** poder iniciar sesión el mismo día de creación,  
**para** no quedar bloqueado por un error de comparación de horas.

#### Acceptance Scenarios

- **Escenario 1.1 — Colegio creado hoy**
  - **Given**: un colegio con `inicioServicio` igual a la fecha actual.
  - **When**: el SCHOOL_ADMIN intenta iniciar sesión.
  - **Then**: el login permite el acceso (estado `vigente`).

- **Escenario 1.2 — Servicio no iniciado**
  - **Given**: un colegio con `inicioServicio` en el futuro.
  - **When**: el SCHOOL_ADMIN intenta iniciar sesión.
  - **Then**: el login se bloquea con mensaje "El servicio del colegio aún no ha comenzado".

- **Escenario 1.3 — Servicio vencido**
  - **Given**: un colegio con `finServicio` en el pasado.
  - **When**: el SCHOOL_ADMIN intenta iniciar sesión.
  - **Then**: el login se bloquea con mensaje "El servicio del colegio ha vencido".

- **Escenario 1.4 — Fin de servicio hoy**
  - **Given**: un colegio con `finServicio` igual a la fecha actual.
  - **When**: el SCHOOL_ADMIN intenta iniciar sesión.
  - **Then**: el login permite el acceso (el último día es vigente).

#### Edge Cases

- Fechas con horas diferentes o zonas horarias no deben afectar la comparación.
- Colegio con `finServicio` null debe considerarse vigente.
- Usuarios no SCHOOL_ADMIN no deben ser afectados por esta validación.

---

### User Story 2 — Restablecer contraseña del SCHOOL_ADMIN (Priority: P1)

**Como** ADMIN,  
**quiero** restablecer la contraseña del SCHOOL_ADMIN de un colegio,  
**para** recuperar el acceso institucional sin recrear el colegio.

#### Acceptance Scenarios

- **Escenario 2.1 — Restablecer desde el panel**
  - **Given**: un colegio existente con su SCHOOL_ADMIN.
  - **When**: el ADMIN hace clic en "Restablecer contraseña" en `/dashboard/admin/colegios/[id]`.
  - **Then**: se genera una contraseña temporal, se marca `debeCambiarPassword: true`, se registra `COLEGIO_PASSWORD_REGENERADA` en `AuditLog` y la UI muestra la contraseña una sola vez.

- **Escenario 2.2 — Solo ADMIN puede restablecer**
  - **Given**: un usuario OPERADOR o SCHOOL_ADMIN intenta restablecer la contraseña.
  - **When**: realiza la petición.
  - **Then**: recibe 403.

#### Edge Cases

- Si el SCHOOL_ADMIN no existe (colegio sin admin), la acción debe reportar error claro.
- La contraseña temporal debe ser aleatoria y no almacenarse en texto plano.

---

### User Story 3 — Mostrar contraseña temporal al crear/restablecer (Priority: P1)

**Como** ADMIN,  
**quiero** ver la contraseña temporal una sola vez tras crear o restablecer el acceso del colegio,  
**para** poder comunicarla al SCHOOL_ADMIN de forma segura.

#### Acceptance Scenarios

- **Escenario 3.1 — Al crear el colegio**
  - **Given**: el ADMIN crea un colegio.
  - **When**: el sistema crea el SCHOOL_ADMIN.
  - **Then**: la UI muestra un modal/toast con la contraseña temporal y el email.

- **Escenario 3.2 — Al restablecer**
  - **Given**: el ADMIN restablece la contraseña.
  - **When**: la operación termina.
  - **Then**: la UI muestra la contraseña temporal en el mismo contexto, sin necesidad de recargar.

- **Escenario 3.3 — No se almacena ni se repite**
  - **Given**: la contraseña fue mostrada.
  - **When**: el ADMIN navega y vuelve.
  - **Then**: la contraseña ya no está disponible; debe regenerarla si se perdió.

---

### User Story 4 — Reenviar email de bienvenida/credenciales (Priority: P2)

**Como** ADMIN,  
**quiero** reenviar el email de bienvenida con las credenciales al SCHOOL_ADMIN,  
**para** facilitar el acceso sin regenerar la contraseña.

#### Acceptance Scenarios

- **Escenario 4.1 — Reenviar email**
  - **Given**: un colegio con SCHOOL_ADMIN activo.
  - **When**: el ADMIN hace clic en "Reenviar email de credenciales".
  - **Then**: se envía el email de bienvenida, se genera una nueva contraseña temporal si el proveedor no permite lectura, se registra `COLEGIO_EMAIL_REENVIADO` en `AuditLog`.

- **Escenario 4.2 — Fallo de envío**
  - **Given**: el servicio de email falla.
  - **When**: el ADMIN reenvía el email.
  - **Then**: la UI muestra la contraseña temporal generada para copia manual.

#### Edge Cases

- Si el email no está configurado, no se produce error crítico; se muestra contraseña temporal.

---

### User Story 5 — Auditoría del colegio para SCHOOL_ADMIN (Priority: P1)

**Como** SCHOOL_ADMIN,  
**quiero** ver las acciones registradas del colegio (cursos, alumnos, identificadores, carga, alertas, PDF),  
**para** tener trazabilidad interna de mi institución.

#### Acceptance Scenarios

- **Escenario 5.1 — Ver auditoría propia**
  - **Given**: un SCHOOL_ADMIN logueado.
  - **When**: accede a `/dashboard/colegio/auditoria`.
  - **Then**: ve un listado paginado con las acciones `COLEGIO_*` de su colegio.

- **Escenario 5.2 — No ver auditoría de otro colegio**
  - **Given**: un SCHOOL_ADMIN del Colegio A.
  - **When**: intenta ver acciones del Colegio B (por URL manipulada o API directa).
  - **Then**: recibe 403 o una lista vacía.

- **Escenario 5.3 — Filtrado por tipo de acción**
  - **Given**: un SCHOOL_ADMIN en la vista de auditoría.
  - **When**: filtra por `COLEGIO_CURSO_CREADO`.
  - **Then**: solo ve creaciones de cursos de su colegio.

#### Edge Cases

- Acciones sin `colegioId` deben ser excluidas de la vista de un colegio.
- Un ADMIN puede ver toda la auditoría (incluyendo COLEGIO_*) desde su vista existente.

---

## Requirements

### Functional Requirements

- **FR-001**: `verificarVigenciaColegio` debe comparar `inicioServicio` y `finServicio` con la fecha actual normalizada a medianoche.
- **FR-002**: El fix de vigencia no debe alterar el comportamiento para fechas de inicio futuras ni fechas de fin pasadas.
- **FR-003**: Solo ADMIN puede restablecer la contraseña del SCHOOL_ADMIN.
- **FR-004**: Restablecer contraseña debe marcar `debeCambiarPassword: true` y generar contraseña temporal aleatoria.
- **FR-005**: La UI debe mostrar la contraseña temporal una sola vez, sin persistirla en estado compartido.
- **FR-006**: Reenviar email debe registrar `COLEGIO_EMAIL_REENVIADO` y, si falla el envío, devolver la contraseña temporal.
- **FR-007**: La auditoría del colegio debe mostrar solo acciones `COLEGIO_*` y solo del colegio al que pertenece el SCHOOL_ADMIN.
- **FR-008**: El aislamiento de auditoría debe ser verificable por tests; un colegio nunca ve acciones de otro colegio.
- **FR-009**: No se modifica ni altera la auditoría de admin, operador ni comité.

### Non-Functional Requirements

- Reutilizar patrones de operadores y comité.
- Migraciones aditivas; nunca destructivas.
- Un solo worker; no afecta el pipeline de reportes.

## Success Criteria

- Parte 1: tests de vigencia pasan y un colegio creado hoy puede iniciar sesión.
- Parte 2: plan aprobado con endpoints y UI definidos; reutilización de operadores documentada.
- Parte 3: plan aprobado con estrategia de aislamiento de `AuditLog` y tests de aislamiento definidos.
- Lint, tsc y build sin errores.

## Assumptions

- El SCHOOL_ADMIN de un colegio es único (índice parcial `colegioId` único no null en `Usuario`).
- El email de bienvenida para SCHOOL_ADMIN puede usar el mismo helper que los operadores adaptando el copy.
- `AuditLog` puede extenderse con `colegioId` nullable sin romper la auditoría existente.

## Implementation

**Fecha**: 2026-07-23 · **Cierre completo**: [`cierre.md`](./cierre.md)

- Parte 1 (vigencia): fuera de alcance por ajuste de ZEUS — ya implementada en `97cdf95a`; verificada (5/5).
- Parte 2: endpoints `regenerar-password` y `reenviar-email` para colegios (solo ADMIN); contraseña temporal una sola vez, nunca persistida en claro ni logueada; UI con botones + bloque de una sola vista.
- Parte 3 (Opción B): migración aditiva `AuditLog.colegioId`; 16 call sites `COLEGIO_*` poblados; `GET /api/colegio/auditoria` con aislamiento estricto; vista `/dashboard/colegio/auditoria`.
- Tests: FR-008 aislamiento 5/5 + endpoints 6/6. Gate: 753/753, lint/tsc/build OK, dev-restart OK.
- Commit: `feat(colegios): restablecer/reenviar credenciales + auditoría aislada del colegio (spec 079)`.

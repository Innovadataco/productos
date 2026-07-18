# Diseño 018 — Operadores de casos (revisión humana)

> Estado: **EN DISEÑO** — esperando revisión del owner antes de tasks/código.
> Fecha: 2026-07-18.

## Contexto: por qué esta spec existe

Con el umbral de clasificación `reportes.classification.umbral_revision = 1.0`, la mayoría de los reportes terminan en estado `REVISION_MANUAL`. Eso es una decisión deliberada de cautela: la IA no publica nada de lo que duda. Pero, sin una cola de revisión humana atendida, los reportes legítimos nunca pasan a `CLASIFICADO`/`CORREGIDO` y, por lo tanto, nunca se vuelven visibles en la consulta pública.

Esta spec es lo que hace **operable** esa cautela: define quién revisa, cómo se asignan los casos y qué puede hacer un operador.

## Decisiones del owner (ya tomadas, no re-abrir)

1. Los operadores son **empleados de la empresa** (selección interna), no usuarios públicos.
2. El admin (Jelkin) crea cada operador y le asigna un rol dentro del equipo.
3. La asignación es **aleatoria por integridad**, para evitar que un operador elija qué casos ve.
4. La asignación es **instantánea** cuando un reporte entra a `REVISION_MANUAL`.
5. El operador que no atiende un caso lo mantiene **trabado** con él hasta que vuelva o un admin reasigne.
6. Va **después del despliegue** actual.

---

## 1. Modelo de roles (partir de lo existente)

### Roles actuales

El sistema ya tiene un enum `RolUsuario`:

```prisma
enum RolUsuario {
  ADMIN
  SCHOOL_ADMIN
  PARENT
}
```

y un modelo `Usuario` con `rol`, `estado` (activo / inactivo / bloqueado) y `tenantId`. La autenticación (login, JWT, cookie, restablecimiento de contraseña) ya funciona sobre este modelo.

### Propuesta de extensión

1. Agregar `OPERADOR` al enum `RolUsuario`.
2. Opcionalmente agregar `SUPERVISOR_OPERADOR` si se quiere diferenciar quien puede reasignar casos y ver métricas del equipo.
3. Crear un modelo ligero `PerfilOperador` ligado a `Usuario` para datos específicos del puesto que no existen hoy:
   - `cupoMaximo` (cantidad máxima de casos abiertos simultáneos).
   - `esRevisorDeApelaciones` (boolean, por la integración con Fase C).
   - `notasInternas` (opcional).
   - `creadoPorId` (qué admin lo dio de alta).
   - `activo` (redundante con `Usuario.estado`, pero útil para filtros rápidos).

```prisma
model PerfilOperador {
  id                    String   @id @default(cuid())
  usuarioId             String   @unique
  cupoMaximo            Int      @default(10)
  esRevisorDeApelaciones Boolean @default(false)
  notasInternas         String?
  creadoPorId           String
  creadoEn              DateTime @default(now())
  actualizadoEn         DateTime @updatedAt

  usuario   Usuario @relation(fields: [usuarioId], references: [id])
}
```

### Alcance por rol

| Rol | Puede operar casos | Puede crear operadores | Ve todas las métricas | Reasigna casos |
|---|---|---|---|---|
| `ADMIN` | Sí | Sí | Sí | Sí |
| `SCHOOL_ADMIN` | No* | Sí (dentro de su tenant) | Solo su tenant | Sí (dentro de su tenant) |
| `OPERADOR` | Sí | No | Solo los suyos | No |
| `SUPERVISOR_OPERADOR` | Sí | No | Del equipo | Sí |

\* Si el tenant necesita que `SCHOOL_ADMIN` también revise, se activa por parámetro sin cambiar el modelo.

### Reutilización

- Login / JWT / middleware de admin: existentes.
- `Usuario.estado` para activar/desactivar.
- `tenantId` para el alcance multi-tenant que ya está en deuda técnica.

---

## 2. Gestión de operadores (CRUD admin)

### Nuevos endpoints

- `GET /api/admin/operadores`
- `POST /api/admin/operadores` → alta, genera contraseña temporal, envía email.
- `PATCH /api/admin/operadores/[id]` → editar nombre, cupo, rol, activo.
- `DELETE /api/admin/operadores/[id]` → desactivación lógica (no borrado físico).

### Datos mínimos del empleado (privacidad)

Se pide solo:
- `email` (también es el usuario de login).
- `nombre` (para mostrar en la UI).
- `rol` dentro del equipo (`OPERADOR` o `SUPERVISOR_OPERADOR`).
- `cupoMaximo`.
- `activo` / `inactivo`.

No se almacenan: documento, teléfono, dirección ni historial personal fuera de `AuditLog`.

### Alta

1. Admin completa email + nombre + rol + cupo.
2. Se crea `Usuario` con `rol = OPERADOR`, `estado = activo` y contraseña temporal.
3. Se crea `PerfilOperador` ligado.
4. Se registra en `AuditLog`: `OPERADOR_CREADO`.
5. Se envía email de bienvenida con link de restablecimiento (reutilizar flujo existente).

### Baja / desactivación

- Cambiar `Usuario.estado` a `inactivo`.
- Los casos que ya tiene asignados **no se mueven automáticamente** (regla del owner: "trabado con él").
- Un admin puede reasignar manualmente desde la cola.
- `AuditLog`: `OPERADOR_DESACTIVADO`.

### UI

Nueva página `/dashboard/admin/operadores`:
- Tabla con nombre, email, rol, estado, casos abiertos, cupo.
- Formulario de alta/edición.
- Botón "Reasignar casos" en la baja (acción manual, no automática).

Reutilizar: `AdminNav`, `AdminReportesTable`, `Badge`, `Button`, `Input`, `GlassCard`.

---

## 3. Motor de asignación

### Disparador

La asignación se ejecuta cuando un reporte pasa a `REVISION_MANUAL`. Esto puede ocurrir en:
- `POST /api/reportes/procesar` (worker).
- Acción manual de un admin que reclasifica un reporte.

### Algoritmo propuesto: aleatorio ponderado por carga inversa

Para respetar la decisión del owner (aleatorio por integridad) sin sobrecargar a un solo operador:

```
peso(operador) = (cupoLibre)^2
probabilidad = peso / sumaPesos
```

Donde `cupoLibre = max(0, cupoMaximo - casosAbiertosAsignados)`.

- Si `cupoLibre = 0`, el operador queda excluido.
- Si todos los operadores tienen `cupoLibre = 0`, el caso queda **sin asignar**.
- Si no hay operadores activos, el caso queda **sin asignar**.

**Justificación:** sigue siendo aleatorio (nadie elige), pero penaliza a quien ya tiene carga. Un operador con pocos casos tiene más probabilidad; uno al límite no recibe más.

### Prioridad y guardas

- Casos con `prioridadAlta = true` (DOXING, keywords críticas, ráfaga) usan el mismo algoritmo, pero en la UI aparecen primero en la cola.
- No se crea una cola separada; se usa el mismo campo `estado = REVISION_MANUAL` más `operadorId` y `prioridadAlta`.
- La asignación es idempotente: si `operadorId` ya está seteado, no se reasigna salvo acción manual.

### Sin operadores disponibles

- El reporte queda en `REVISION_MANUAL` con `operadorId = null`.
- La cola admin muestra un filtro "Sin operador asignado".
- Se envía alerta por email al admin (`reportes.operador.sin_asignacion` notifica cada N minutos, configurable en `ParametroSistema`).

### Reasignación manual

- Un admin o supervisor puede cambiar `operadorId` desde la cola.
- Se registra en `AuditLog`: `OPERADOR_REASIGNADO` con `operadorAnteriorId`, `operadorNuevoId` y motivo.

### Parámetros configurables (ParametroSistema)

- `operadores.cupo_default` → cupo máximo por defecto.
- `operadores.notificacion_sin_operador_minutos` → frecuencia de alerta admin.
- `operadores.prioridad_alta_salta_fila` → si los de alta prioridad se listan primero.

---

## 4. Trazabilidad y confidencialidad

### Qué puede ver un operador

Solo los reportes asignados a él (`Reporte.operadorId = usuario.id`). Puede ver:
- Texto del reporte (incluyendo PII si aplica, porque necesita juzgar el caso).
- Clasificación IA, confianza, votos y guardas que activaron la revisión.
- Datos del identificador, plataforma, ciudad/país.
- Historial de acciones del caso (`AuditLog`).

No puede ver:
- Configuración de scoring, modelos, parámetros de seguridad.
- Dataset de entrenamiento ni experimentos IA.
- Datos de otros operadores ni casos ajenos.

### Qué puede hacer un operador

| Acción | Efecto en el reporte | Registro |
|---|---|---|
| Confirmar clasificación | Estado `CLASIFICADO` | `CASO_CONFIRMADO` |
| Corregir categoría | Estado `CORREGIDO` + nueva categoría | `CASO_CORREGIDO` |
| Marcar como falso / spam | `REPORTE_FALSO` (baja lógica) | `CASO_DADO_DE_BAJA` |
| Escalar | `prioridadAlta = true` + notifica admin | `CASO_ESCALADO` |
| Agregar nota interna | Campo `notaRevision` | `CASO_NOTA_AGREGADA` |

### Confidencialidad

- Toda acción de operador se registra en `AuditLog` (quién, qué caso, timestamp).
- No hay exportación masiva desde la UI de operador.
- El operador no puede editar parámetros del sistema.
- Timeout de sesión y revalidación de cookie por cada acción sensible.

---

## 5. Integración con módulos existentes

### 5.1 Cola de revisión `/api/admin/reportes-revision`

Endpoints actuales:
- `GET /api/admin/reportes-revision` → listar reportes en revisión.
- `GET /api/admin/reportes-revision/[id]` → detalle.
- `POST /api/admin/reportes-revision/[id]/confirmar` → confirmar.

Cambios de diseño:
- Incluir `operadorId` en la respuesta.
- Filtros nuevos: `?sinOperador=true`, `?mios=true`, `?prioridadAlta=true`.
- Solo `OPERADOR` ve los casos donde `operadorId = suId` (salvo que sea supervisor/admin).
- Los endpoints de acción (`confirmar`, etc.) validan que el usuario sea el operador asignado o tenga permisos superiores.

### 5.2 Apelaciones (Fase C)

Hoy las apelaciones las resuelve un admin desde `/dashboard/admin/apelaciones`.

Opción recomendada: que las apelaciones pasen también por el pool de operadores, pero solo a operadores con `PerfilOperador.esRevisorDeApelaciones = true`. Esto descongestiona al admin y mantiene la integridad (asignación aleatoria).

Cambios:
- Al recibir una apelación, si ya hay operadores habilitados para apelaciones, se asigna.
- El operador puede aceptar/rechazar, con las mismas reglas de pausa de visibilidad de la Fase C.
- AuditLog: `APELACION_ASIGNADA`, `APELACION_RESUELTA`.

### 5.3 Kanban (futuro)

Si se construye, el kanban es solo una vista de la misma tabla `Reporte`, agrupada por estado interno del operador:
- Sin asignar
- Asignado
- En revisión
- Resuelto hoy

Reutilizar componentes: `AdminReportesTable`, `Badge`, `GlassCard`.

---

## 6. Análisis de riesgo

| Actor / amenaza | Qué gana | Qué NO gana | Mitigación |
|---|---|---|---|
| **Operador malicioso** que confirma casos falsos | Puede publicar un reporte injusto | No puede elegir qué casos revisa; sus acciones quedan registradas | Asignación aleatoria + AuditLog + supervisor que audita muestras |
| **Operador que ignora casos** | Tiempo libre | No puede cerrar casos ajenos; el caso queda trabado con él | Métricas de tiempo de resolución, alerta de casos viejos, reasignación manual por admin |
| **Colusión** entre operador y denunciante | El operador podría beneficiar a un tercero | No puede asignarse el caso; no ve datos de otros operadores | Asignación aleatoria, sin auto-asignación, revisor supervisor |
| **Fuga de datos** | Copiar texto de menores | No puede exportar masivamente ni ver casos ajenos | Sin export, acceso solo a casos asignados, AuditLog, timeouts |
| **Sin operadores activos** | — | — | Cola "sin asignar" visible para admin + alertas recurrentes |

---

## 7. Fases de implementación (en orden de dependencia)

| Fase | Qué incluye | Esfuerzo estimado | Bloquea a |
|---|---|---|---|
| **1. Schema y auth** | Agregar `OPERADOR` a `RolUsuario`, crear `PerfilOperador`, actualizar middleware de permisos. | Chico | Todo lo demás |
| **2. CRUD de operadores** | Página `/dashboard/admin/operadores`, endpoints API, email de alta. | Mediano | Fase 3 |
| **3. Motor de asignación** | Función de asignación al pasar a `REVISION_MANUAL`, `AuditLog`, reasignación manual. | Mediano | Fase 4 |
| **4. UI de cola para operadores** | Vista `/dashboard/revision` (o similar) con acciones confirmar/corregir/baja/escalar. | Mediano | Fase 5 |
| **5. Integración con apelaciones** | Asignar apelaciones a operadores habilitados. | Mediano | Fase 6 |
| **6. Tests, evals y smoke** | Unit + e2e de asignación, acciones, permisos, smoke E2E. | Mediano | — |

**Nota de despliegue:** esta spec se implementa después del despliegue inicial. Hasta entonces, el admin (`ADMIN`) seguirá siendo quien revise manualmente los casos desde `/dashboard/admin/reportes-revision`.

---

## 8. Reutilización de componentes existentes

- **Auth:** login, JWT, cookies, restablecimiento de contraseña.
- **Admin layout y navegación:** `AdminNav` para agregar el link "Operadores".
- **Tablas y tarjetas:** `AdminReportesTable`, `GlassCard`, `Badge`, `Button`, `Input`.
- **Configuración:** `ParametroSistema` para cupo default y alertas.
- **Auditoría:** modelo `AuditLog` y utilidad de registro.
- **Anti-abuso:** rate-limit existente para endpoints de operador.
- **Email:** utilidad de envío para alta de operador.

## 9. Preguntas abiertas para el owner

1. ¿Se necesita el rol `SUPERVISOR_OPERADOR` o alcanza con que un `ADMIN` reasigne?
2. ¿Las apelaciones entran al pool de operadores en la primera versión o se dejan para una fase posterior?
3. ¿El cupo máximo por operador es global o por tipo de caso (reportes vs. apelaciones)?

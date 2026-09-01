# Data Model · SPEC-339 · El camino guiado del padre

**Fase 1** · 31-08-2026 · tres migraciones, todas aditivas salvo la nota explícita de `Hijo`.

---

## 1. `Usuario` — el documento del padre

Campos nuevos, ambos opcionales en el esquema (hay cuentas vivas sin ellos) y **obligatorios en el Paso 2** por validación:

| Campo | Tipo | Notas |
|---|---|---|
| `documentoTipo` | `String?` | Conjunto cerrado en Zod: `CC \| CE \| PASAPORTE \| NIT \| OTRO` |
| `documentoNumero` | `String?` | Se guarda recortado; nunca aparece en claro en la auditoría |

**Índice**: `@@index([documentoTipo, documentoNumero])` para las búsquedas del administrador. **No** se declara único: dos padres podrían compartir tipo y número por error de digitación, y bloquear un registro por eso dejaría a un padre afuera sin poder resolverlo solo.

**Lo que NO cambia**: `fechaNacimiento` **se queda en la base de datos** y simplemente deja de pedirse (decisión CEO D-2). No se borra ni se hace obligatoria.

---

## 2. `Hijo` — cada menor con padre propio

Este es el cambio delicado del PR.

### Antes

- La ficha del menor era **global** y única por `(documentoTipo, documentoNumero)` en todo el sistema.
- El padre se ataba por la tabla puente `HijoPadre`; dos padres compartían la misma fila.
- Consecuencia verificada: el interruptor del menor, el interruptor de cada cuenta y los datos del menor eran **compartidos**. Un padre le apagaba los avisos al otro.

### Después

| Campo | Cambio |
|---|---|
| `usuarioId` | **Nuevo**, obligatorio. El menor pertenece a un padre. |
| `@@unique([documentoTipo, documentoNumero])` | **Se retira** (era global). |
| `@@unique([usuarioId, documentoTipo, documentoNumero])` | **Nuevo**. Un padre no repite un documento; dos padres sí pueden tener al mismo menor. |
| `@@index([usuarioId])` | Nuevo, para listar la lista de cada padre. |

**Regla de negocio resultante** (Jelkin, 31-08): *si otro padre se registra con otro correo y quiere vincular a los mismos hijos, no pasa absolutamente nada*. Cada padre tiene su lista, sus interruptores y sus avisos.

### Migración de datos

Conteo en producción confirmado por el CEO el 31-08: **0 menores con más de un padre**. Por lo tanto:

1. Añadir `usuarioId` como opcional.
2. Rellenarlo desde la tabla puente (hoy es 1 a 1, así que no se duplica ni una fila).
3. Volverlo obligatorio y cambiar las restricciones de unicidad.

La migración **DEBE fallar en voz alta**, no en silencio, si al ejecutarse encuentra un menor con más de un padre: en ese caso el supuesto que la habilita ya no es cierto y hay que partir fichas, que es trabajo de otra spec.

### Lo que queda inactivo y no se borra

Orden del CEO, por si Jelkin revierte la regla:

- **`HijoPadre`**: deja de ser la vía de acceso; el servicio pasa a exigir `usuarioId` en la propia ficha. El modelo se conserva, marcado en el esquema como sin uso, con la razón y la fecha.
- **`IdentificadorHijoDesvinculado`**: era el parche para que cada padre tuviera su propia vista de las cuentas de una ficha compartida. Con ficha propia pierde sentido. Se conserva, marcado igual, y deja de escribirse y de leerse.

---

## 3. `TokenRegistro` — el enlace del correo

Modelo nuevo, calcado de `TokenRecuperacion` (mismo patrón probado).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `email` | `String` | A quién se le mandó el enlace |
| `tokenHash` | `String` | **Solo el hash.** El token viaja en el enlace y no se guarda en claro |
| `expiraEn` | `DateTime` | 24 horas (brief §2.1) |
| `usado` | `Boolean @default(false)` | Un solo uso |
| `creadoEn` / `actualizadoEn` | `DateTime` | |

**Índices**: `email`, `tokenHash`, `expiraEn`.

**Sin relación con `Usuario`**: en el momento de pedir el enlace la cuenta todavía no existe. La cuenta se crea al completar.

---

## 4. `ParametroSistema` — el tope de menores

| Clave | Valor sembrado | Tipo | Descripción |
|---|---|---|---|
| `padre.hijos.maximo` | `5` | `INTEGER` | Máximo de menores que un padre puede registrar |

Siembra idempotente en el bloque `padre.*` que ya existe. El administrador lo edita sin desplegar.

---

## 5. Motor de notificaciones — dos eventos nuevos

| Evento | Plantilla | Cuándo |
|---|---|---|
| `auth.registro_enlace` | correo con el enlace de un solo uso, vence en 24 h | Al pedir el registro con un correo sin cuenta |
| `auth.bienvenida_padre` | confirmación de que la cuenta quedó creada | Al guardar la contraseña |

Ambos con regla y plantilla sembradas, e incorporados a la lista del ratchet de migración de correos. El aviso «ya tienes una cuenta» de SPEC-338 se reutiliza tal cual para el correo que ya existe.

---

## 6. El estado del camino — derivado, nunca almacenado

**No hay tabla ni columna de «paso alcanzado».** El paso pendiente se calcula, en este orden, desde datos que ya existen:

| Paso | Se considera cumplido cuando | Fuente |
|---|---|---|
| 1 · Permiso | El consentimiento vigente está aceptado | comprobación de consentimiento ya existente |
| 2 · Tus datos | Nombres, apellidos, tipo y número de documento, teléfono, país y ciudad están completos | `Usuario` |
| 3 · Tus hijos | Tiene **al menos un** menor | `Hijo` por `usuarioId` |
| 4 · Tu plan | Tiene una suscripción resuelta | consulta de suscripción ya existente |

El primer paso incumplido, de menor a mayor, es el paso pendiente. Sin ninguno incumplido, el camino está terminado.

**Por qué derivado**: una columna de progreso es una segunda fuente de verdad que se desincroniza de los hechos — exactamente la familia de defectos I-211 / I-222 / I-224 / I-227. Además hace que el camino se sostenga solo: si el padre borra su único menor, vuelve al Paso 3 sin que nadie tenga que acordarse de revertir un campo.

**Dónde viaja**: como un campo más del valor firmado de `sesion_estado`, junto a consentimiento, cambio de contraseña y vigencia. Se recalcula en cada re-sellado (al entrar, al completar cada paso, y cada 5 minutos por vencimiento de la cookie).

**Compatibilidad**: la lectura de la cookie valida hoy campo por campo y descarta el valor si falta alguno. Una cookie emitida antes del despliegue no tendrá el campo nuevo: se descarta y se vuelve a sellar en el rebote. Sin sesiones rotas y sin nadie que tenga que volver a entrar.

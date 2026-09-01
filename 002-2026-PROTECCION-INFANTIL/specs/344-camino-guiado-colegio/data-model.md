# Data Model: Camino guiado del colegio (SPEC-344)

Sin refactor de schema. Migraciones **aditivas**. Todo el estado del "paso
pendiente" se DERIVA (no se persiste) — misma disciplina que `estado.ts:2-17`.

## Cambios de schema (aditivos)

### `TokenRegistro` — nuevo campo `rol`

```prisma
model TokenRegistro {
  id        String     @id @default(cuid())
  email     String
  tokenHash String
  expiraEn  DateTime
  usado     Boolean    @default(false)
  rol       RolUsuario @default(PARENT)   // NUEVO · SPEC-344 aditivo
  createdAt DateTime   @default(now())
  @@index([email, expiraEn])
}
```

**Impacto**: filas existentes quedan como `PARENT` (correcto: no había otros).
`RegistroEnlaceService.solicitarEnlace(email, rol)` y `.completar(token,
password, rol?)` parametrizan por rol; el completar fuerza el rol del token
(no confía en el cliente).

### `AcudienteEstudiante` — documento opcional

```prisma
model AcudienteEstudiante {
  // … campos existentes
  documentoTipo   String?  // NUEVO · SPEC-344 aditivo, valida contra TipoDocumento activo
  documentoNumero String?  // NUEVO · SPEC-344 aditivo, sin unicidad
  // … índices y unique existentes
}
```

**Impacto**: filas existentes quedan con ambos `null`. Sin restricciones
nuevas. UI: `SeccionAcudientes.tsx` y `unificado/tipos.ts` ganan los campos
etiquetados "(opcional)".

### `Colegio` — sin cambios de columna, cambio de valor por acción del usuario

`representanteLegalIdentificacion` sigue como `String` no-nulo. El literal
`"PENDIENTE"` sembrado por `registro-colegio.ts:317` se reemplaza cuando el
rector completa el Paso 1 (no en la migración). Si en implementación
resulta más limpio separar `representanteLegalTipoDoc` (columna aditiva
opcional), se hace también aditivo — R4 lo evalúa en tiempo de desarrollo.

## Entidades

### Estado del camino del colegio (derivado, no persistido)

```
type PasoColegio = "rector" | "plan" | "profesores" | "cursos" | "estudiantes"
type PasoPendienteColegio = PasoColegio | null
```

`derivarPasoPendienteColegio(usuarioId)` en
`src/lib/dal/services/camino/estado-colegio.ts`:

| Paso | Condición | Query |
|---|---|---|
| `rector` | Consentimiento CONVENIO_INSTITUCIONAL vigente + 5 campos de Usuario | `requiereConsentimientoActual(u) === false` && `Usuario.select({documentoTipo, documentoNumero, nombre, apellidos, telefono})` sin vacíos |
| `plan` | ≥ 1 Suscripcion del colegio | `Suscripcion.count({ colegioId }) > 0` |
| `profesores` | ≥ 1 profesor activo | `Profesor.count({ colegioId, estado: "activo" }) > 0` |
| `cursos` | ≥ 1 curso activo | `Curso.count({ colegioId, estado: "activo" }) > 0` |
| `estudiantes` | ≥ 1 estudiante activo del colegio | `Estudiante.count({ colegio: { id: colegioId }, estado: "activo" }) > 0` |

Todos los `count` con índices existentes. Sin nuevas migraciones de índices.

### Registry de pasos (Edge-safe, cero Prisma)

```
// src/lib/camino/pasos-colegio.ts
PASOS_COLEGIO = ["rector","plan","profesores","cursos","estudiantes"] as const
RAIZ_CAMINO_COLEGIO = "/camino/colegio"
DEFINICION_PASOS_COLEGIO = {
  rector:      { numero:1, destino:"/camino/colegio/rector",      titulo:"Quién responde" },
  plan:        { numero:2, destino:"/camino/colegio/plan",        titulo:"Su plan" },
  profesores:  { numero:3, destino:"/camino/colegio/profesores",  titulo:"Sus profesores" },
  cursos:      { numero:4, destino:"/camino/colegio/cursos",      titulo:"Cursos y materias" },
  estudiantes: { numero:5, destino:"/camino/colegio/estudiantes", titulo:"Sus estudiantes" },
}
DESTINO_CIERRE_COLEGIO = "/camino/colegio/listo"
esPasoColegio(v): v is PasoColegio
```

`src/lib/camino/pasos.ts` gana:

```
destinoParaRol(rol, paso) {
  if (rol === "PARENT")       return destinoDePaso(paso as PasoCamino)
  if (rol === "SCHOOL_ADMIN") return destinoDePasoColegio(paso as PasoColegio)
  return null
}
```

### Cookie `sesion_estado` (formato inalterado, valores extendidos)

`SesionEstadoPayload.pasoCamino: string | null` acepta ahora valores del
padre O del colegio. `esPasoCamino` en `vigencia-cookie.ts:124` se generaliza
a `esPasoCamino(v) := esPasoPadre(v) || esPasoColegio(v)`. Cookies vivas con
valores del padre siguen validando (ningún corte). Cookies emitidas para
SCHOOL_ADMIN antes del deploy quedan con `pasoCamino: null`; al primer
rebote fail-closed re-sellan con el paso correcto.

### Guardias (`src/lib/routing/guardias.ts`) — cambios aditivos

```
GUARDIAS_ACCESO.camino.exentas — se agrega discriminación por rol o un
bloque adicional `camino.exentasSchoolAdmin` con:
  /camino/colegio                 (y todos sus subpath)
  /api/colegio/rector             (endpoints del Paso 1 si los hay)
  /api/colegio/suscripcion        (Paso 2, incluye activar-freemium)
  /api/colegio/profesores         (Paso 3)
  /api/colegio/carga-profesores   (Paso 3)
  /api/colegio/cursos             (Paso 4)
  /api/colegio/carga              (Paso 5, wizard unificado existente)
  /api/colegio/alumnos            (Paso 5)
  /api/pagos                      (bono/referido, ya exento para PARENT)
  /login, /api/auth/logout, /cambiar-password    (salidas)
  /api/sesion/al-dia, /api/session/ping, /api/vigencia/refresh (sesión)
  /reportar, /dashboard/colegio/reportar (si existieran), /api/reportes
    (mismo precedente A-67: reportar nunca se bloquea por camino)

GUARDIAS_ACCESO.vigencia.SCHOOL_ADMIN.exentas — se extiende con TODOS los
destinos del camino colegio + los endpoints listados arriba, para que la
invariante cruzada pase.
```

### Registro `TokenRegistroColegio` (NO — se descarta)

Ver research R5: se descarta modelo hermano; se usa `TokenRegistro.rol`.

## Estados y transiciones

**Paso `rector` cumple**: cuando el rector guarda los 5 campos del formulario
(persisten en `Usuario` + reflejo en `Colegio.representanteLegal*`) Y el
consentimiento del colegio se marca aceptado (`requiereConsentimientoActual`
devuelve `false`). Server action re-sella la cookie.

**Paso `plan` cumple**: al activar freemium (`POST
/api/colegio/suscripcion/activar-freemium`) o al solicitar plan pagado
(`POST /api/colegio/suscripcion/solicitar-plan`). En ambos casos:
- Se crea/actualiza `Suscripcion` (colegioId).
- Se ESCRIBE `Colegio.finServicio` con la ventana calculada (puente D2, R6).
- Server action re-sella la cookie.

**Paso `profesores` cumple**: al crear el primer profesor activo (individual
o vía Excel `POST /api/colegio/carga-profesores/confirmar`). La creación ya
usa `sellarCookieSesionEstado` (variante NextResponse). Se agrega el mismo
sellado a los endpoints nuevos.

**Paso `cursos` cumple**: los 11 sembrados ya lo cumplen desde
`crearColegioMinimo`. Si el rector los inactiva todos, el guardián lo
devuelve al Paso 4.

**Paso `estudiantes` cumple**: al crear el primer estudiante activo (vía
alta individual o wizard unificado). Sellado en los endpoints
correspondientes.

## Consumidores existentes que deben quedar intactos

- Padre A-67 (`src/lib/camino/pasos.ts`, `estado.ts`, `middleware.ts`
  guardián, cookie): superficie externa inalterada. Los tests unit del
  padre (`camino-padre.spec.ts`, `estado.test.ts`, `middleware.test.ts`)
  pasan sin modificar.
- COMITE_CONVIVENCIA: sin cambios; `pasoCamino: null` en su cookie. Tests
  que lo afirman siguen pasando.
- Roles internos (ADMIN, OPERADOR, COMITE_VALIDACION): `pasoCamino: null`.
- `OnboardingColegio`: modelo se conserva; endpoints devuelven lo mismo
  pero nadie los llama desde el dashboard; el modal no se monta.

## Migraciones a generar (Prisma)

Una migración nueva `YYYYMMDDHHMMSS_camino_colegio_aditivo`:

```sql
ALTER TABLE "TokenRegistro" ADD COLUMN "rol" "RolUsuario" NOT NULL DEFAULT 'PARENT';
ALTER TABLE "AcudienteEstudiante" ADD COLUMN "documentoTipo" TEXT;
ALTER TABLE "AcudienteEstudiante" ADD COLUMN "documentoNumero" TEXT;
-- (opcional según R4) ALTER TABLE "Colegio" ADD COLUMN "representanteLegalTipoDoc" TEXT;
```

Todas aditivas, ninguna destructiva. `prisma migrate deploy` sin bloqueos.

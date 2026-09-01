# Research: Camino guiado del colegio (SPEC-344 · A-69 · C1)

## R1 · Registry de pasos del camino por rol (Edge-safe)

**Decision**: crear `src/lib/camino/pasos-colegio.ts` hermano de `pasos.ts`
con `PASOS_COLEGIO`, `DEFINICION_PASOS_COLEGIO`, `RAIZ_CAMINO_COLEGIO =
"/camino/colegio"`. Ambos módulos exponen su propio `PasoPendienteX` y
`destinoDePasoX`. Un helper de más alto nivel en `pasos.ts` (`destinoParaRol(rol,
paso)`) despacha por rol. Cero Prisma en el módulo (Edge).

**Rationale**: la union tipada (`type PasoCamino = PasoPadre | PasoColegio`)
crece `esPasoCamino` (`vigencia-cookie.ts:124`), invalida cookies vivas en
más casos y es más frágil bajo evoluciones. Un módulo hermano mantiene la
disciplina de "una fuente por dominio" y minimiza el impacto en el padre.

**Alternatives considered**:
- Union tipada única en `pasos.ts`: rechazada por la razón anterior.
- Persistir el paso en BD (columna en `Colegio.pasoActual`): rechazada — es
  exactamente lo que mata `estado.ts:2-17`. `OnboardingColegio.pasoActual`
  hoy vivo es la evidencia de que ese patrón se corrompe.

## R2 · Superficie mínima del cambio en la cadena de guardias

**Decision**: cinco puntos precisos, todos en archivos ya existentes:

1. `src/lib/routing/sesion-estado-emitter.ts:46` — línea única del `if`:
   `const paso = rol === "PARENT" ? await derivarPasoPendiente(u) :
   rol === "SCHOOL_ADMIN" ? await derivarPasoPendienteColegio(u) : null;`.
2. `src/lib/routing/vigencia-cookie.ts` — sin cambios en firma; el campo
   `pasoCamino` acepta valores nuevos si se extiende la type-guard `esPasoCamino`
   para reconocer los del colegio (o se relaja a "string cualquiera" y se
   valida por rol en el emisor — evaluado y rechazado por seguridad de tipo).
   Se opta por importar también `esPasoCamino` de `pasos-colegio.ts` y
   preguntar `esPasoCaminoPadre(v) || esPasoCaminoColegio(v)`.
3. `middleware.ts:221` — condición: `sesion.rol === "PARENT" ||
   sesion.rol === "SCHOOL_ADMIN"`. Se importa `destinoParaRol` y se despacha.
4. `middleware.ts:270` (rebote fail-closed) — misma generalización.
5. `src/lib/routing/guardias.ts:245-246` — invariante cruzada
   generalizada a `exentasDe("vigencia", rol)` (rol como parámetro). Los
   destinos del camino colegio (`/camino/colegio/**`, sus APIs de perfil,
   suscripción, profesores, cursos, materias, estudiantes, sesión) se
   añaden a `vigencia.SCHOOL_ADMIN.exentas`. Sin esto, la invariante NO
   detecta desalineaciones y aparecen en producción como bucle
   I-25/I-111/I-141.

**Rationale**: son cinco cambios pequeños, cada uno cazable por su test unit
existente actualizado. Ninguno introduce un mecanismo nuevo; todos amplifican
uno existente. El padre no gana lógica nueva.

**Alternatives considered**:
- Segundo campo `pasoCaminoColegio` en `SesionEstadoPayload`: rechazada — dos
  campos + dos guardianes duplican la superficie.
- Guardián nuevo, paralelo al del padre en `middleware.ts`: rechazada — el
  orden y el fail-closed se vuelven frágiles con dos guardianes que hacen lo
  mismo con distinto rol.

## R3 · Derivación de los 5 pasos del colegio

**Decision**: `derivarPasoPendienteColegio(usuarioId)` en
`src/lib/dal/services/camino/estado-colegio.ts`, misma disciplina que
`estado.ts` (Node + Prisma, prohibido importar desde Edge):

| Paso | Condición cumplida |
|---|---|
| 1 `rector` | consentimiento CONVENIO_INSTITUCIONAL vigente **Y** 5 campos del rector no vacíos (`documentoTipo`, `documentoNumero`, `nombre`, `apellidos`, `telefono` en `Usuario`) |
| 2 `plan` | `Suscripcion.count({ colegioId }) > 0` — cualquier suscripción, freemium activada o pagada en `PENDIENTE_AUTORIZACION` (regla A-67) |
| 3 `profesores` | `Profesor.count({ colegioId, estado: "activo" }) > 0` |
| 4 `cursos` | `Curso.count({ colegioId, estado: "activo" }) > 0` (los 11 sembrados cumplen desde el arranque; si el rector los inactiva todos, vuelve) |
| 5 `estudiantes` | `Estudiante.count({ colegio: { id: colegioId }, estado: "activo" }) > 0` |

**Rationale**: mismo patrón A-67 (los 4 pasos del padre son cuentas contra
hechos ya existentes). Todos los `count` con índices existentes (colegioId
denormalizado en las tablas). Rol SCHOOL_ADMIN → busca su `Colegio` por
`Usuario.colegioId` (`prisma/schema.prisma:562-565`).

**Alternatives considered**:
- Reutilizar `OnboardingColegio.pasoActual`: rechazada por §Regla nada
  segundas fuentes de verdad.
- Consentimiento como paso 0 separado del rector: rechazada — el rector y
  el convenio se firman juntos en la misma pantalla (mockup 1.2); el
  guardián de consentimiento corre ANTES del guardián del camino
  (`middleware.ts:194` vs `:221`), por lo que ambos coinciden en Paso 1
  sin conflicto (patrón A-67 con `/consentimiento` como paso 1 del padre).

## R4 · Datos del rector: Usuario como fuente, Colegio como reflejo

**Decision** (D-1 confirmado por CEO): la fuente de verdad de los datos del
rector es `Usuario` (patrón A-67, campos ya existentes: `documentoTipo`,
`documentoNumero`, `nombre`, `apellidos`, `telefono`, `paisId`, `ciudadId`).
En el mismo commit del Paso 1 se ACTUALIZA `Colegio.representanteLegalNombre`
(concatenando `nombre + " " + apellidos`) y `representanteLegal-
Identificacion` (concatenando `documentoTipo + " " + documentoNumero`) para
seguir sirviendo a los consumidores que leen del Colegio, y se puebla
`representanteLegalTelefono` si estaba `null`.

**Rationale**: minimiza migración (Usuario ya tiene todo), evita duplicar la
lógica de validación, y respeta el patrón A-67. El `"PENDIENTE"` literal en
las 0-N filas vivas se limpia por acción del rector al completar el Paso 1;
la migración inicial NO reescribe el valor (sería adivinar sin datos).

**Alternatives considered**:
- Columna nueva `Colegio.representanteLegalTipoDoc` + separar identificacion:
  aditivo pero abre la puerta a que Colegio y Usuario divergan. Se evalúa
  como fallback si la concatenación rompe algún consumidor (no encontrado en
  la enumeración 22v5).
- Solo Colegio, sin tocar Usuario: rechazada — el emisor lee de `Usuario`
  para el resto del camino (`derivarPasoPendienteColegio` necesita el
  Usuario), y `Colegio.representanteLegalIdentificacion` es un único string
  sin separación tipo/número.

## R5 · Registro por enlace del colegio (TokenRegistro con rol)

**Decision**: agregar `rol RolUsuario @default("PARENT")` a `TokenRegistro`
(aditivo). `RegistroEnlaceService.solicitarEnlace(email, rol)` y
`.completar(token, password, rol?)` parametrizables. Dos nuevos endpoints
`/api/auth/registro-colegio/{solicitar, completar}` reutilizan el servicio,
pasando `rol: "SCHOOL_ADMIN"`. El solicitar acepta `{email, nombreColegio,
nit}` y hace anti-enumeración por AMBAS dimensiones (patrón SPEC-338):

- Correo NO existe Y NIT NO existe → crea token, envía enlace.
- Correo YA existe Y NIT NO existe → NO crea token, envía
  `colegio.registro_enlace.cuenta_existente` al correo registrado.
- Correo NO existe Y NIT YA existe → NO crea token, envía
  `colegio.registro_enlace.nit_ya_registrado` al correo del colegio dueño
  del NIT.
- Ambos YA existen → mismo `colegio.registro_enlace.cuenta_existente`.

En los cuatro casos la respuesta HTTP y la pantalla son idénticas (202 con
`MENSAJE_EXITO`), preservando anti-enumeración por ambas dimensiones.

**Rationale**: brief y matiz CEO 03:18 exigen anti-enumeración por AMBAS.
`TokenRegistro` con columna aditiva `rol` es la mínima superficie que
también respeta la promesa A-67 de "el padre sigue funcionando exactamente
igual".

**Alternatives considered**:
- Modelo `TokenRegistroColegio` hermano: duplicaría lógica de expiración /
  bcrypt / rate-limit sin ganancia.
- `TokenRegistro.tipo enum`: enum agrega maquinaria; una columna `rol`
  RolUsuario ya existe y encaja.
- Solo NIT (sin correo): rechazado — dos rectores del mismo colegio con
  correos distintos necesitarían dos ingresos.

## R6 · Puente D2 con `calcularFinServicio` (A-64)

**Decision** (matiz CEO 03:18): al cerrar el Paso 2 del camino,
`Colegio.finServicio` se escribe según el plan elegido:

- Freemium: `finServicio = hoy + pagos.freemium.duracion_dias` días
  (parametrizable; sembrado en 30, `prisma/seed.ts:752`). Se persiste con
  `esFreemium=true` en `Suscripcion` (patrón espejo de
  `/api/padre/suscripcion/activar-freemium`).
- Pagado (queda en `PENDIENTE_AUTORIZACION`): `finServicio =
  calcularFinServicio(inicio, tipoPeriodo)` según `Plan.duracion`
  (`MENSUAL`, `SEMESTRAL`, `ANUAL`), reusando `src/lib/colegio/periodo.ts`
  (SPEC A-64, ya con test).

Los endpoints tocados:
- `POST /api/colegio/suscripcion/activar-freemium` (NUEVO, espejo del padre).
- `POST /api/colegio/suscripcion/solicitar-plan` (EXISTENTE, se extiende):
  además de crear `Suscripcion PENDIENTE_AUTORIZACION`, actualiza
  `Colegio.finServicio` con la ventana calculada.

**Rationale**: cierra el bug D2 "gratis para siempre" en el auto-registro
sin refactorizar la fuente de vigencia. El mecanismo A-64 ya está probado.
La unificación profunda (vigencia colegio ← Suscripcion) queda para otra
spec del brief.

**Alternatives considered**:
- Mi propuesta original de deferral cosmético: rechazada por el CEO
  correctamente — un rector que pasa el camino y aún queda gratis rompe la
  intención del brief.
- Unificar vigencia colegio ← Suscripcion en C1: rechazada por scope; toca
  el emisor (`sesion-estado-emitter.ts:33-35`), múltiples repositorios,
  layouts, y el ratchet de vigencia. Fuera del alcance C1.

## R7 · 11 grados sembrados idempotente

**Decision**: crear `src/lib/colegio/cursos-seed.ts` con
`crearCursosPorDefecto(colegioId, anioLectivo, tx?)`. Lista de grados en
`src/lib/colegio/grados.ts:2` (`Grado 1º` … `Grado 11º`), ya existe como
opciones de UI — se reutiliza. Idempotente (upsert sobre `@@unique([colegioId,
nombre, grado, anioLectivo])`, `prisma/schema.prisma:1235`). Se llama desde
`crearColegioMinimo` (`src/lib/dal/services/registro-colegio.ts:326`) justo
después de `seedMateriasPorDefecto`. El `anioLectivo` = año del sistema en el
momento (`new Date().getFullYear().toString()`).

**Rationale**: al llegar al Paso 4 el rector ya ve los 11; el mockup 1.5 lo
pinta así. Idempotente cubre el caso de "usuario ya creado por admin y luego
completa el camino" (los cursos ya estarán, el upsert no duplica).

**Alternatives considered**:
- Sembrar en el Paso 4 al primera visita: rechazada — carga estado al
  cliente, y "primer visita" es una condición frágil (¿qué pasa si abandona?
  ¿si vuelve al día siguiente?).
- Parametrizar la lista de grados: el brief §5 no lo pide; se difiere.

## R8 · D3 candado servidor sin migrar schema

**Decision**: rechazar `profesorId` nulo/vacío/inexistente en:
- `POST /api/colegio/cursos/[id]/materias` (`route.ts:63,90`) — modificar
  `cursoMateriaBodySchema` (`src/lib/schemas/index.ts:239`) para EXIGIR
  `profesorId: cuidIdSchema` (dropear `.optional().nullable()`).
- `PATCH /api/colegio/cursos/[id]/materias/[materiaId]` (NUEVO) — mismo
  schema.
- `src/lib/dal/repositories/curso-materia.ts:55` (`crear`) — validar que
  `profesorId` no sea `null`/`""` y que el profesor exista, esté activo y
  sea del mismo colegio (guardas ya existen para el caso happy `:74-82`).

El schema Prisma `CursoMateria.profesorId String?` NO cambia — respeta el
histórico. La UI del wizard existente (`SeccionMateriasCurso.tsx:143-151`,
selector "Profesor (opcional)") se ajusta: cambia el label a "Profesor a
cargo" y el `disabled` se mantiene hasta que haya profesor seleccionado.

**Rationale**: separar el modelo de datos (permisivo) del contrato
(estricto) es la disciplina que la constitución §3.6 promueve. Retro-migrar
`profesorId` a `String` no-nulo requiere retro-llenar filas y bloquear
inserts históricos — fuera de alcance.

**Alternatives considered**:
- Migrar schema a no-nulo: rechazada por regla aditividad.
- Solo validar en UI: rechazada — un rector con curl/Postman se lo salta.

## R9 · Documento aditivo en `AcudienteEstudiante`

**Decision**: migración aditiva con dos columnas nullable:
```prisma
documentoTipo   String?
documentoNumero String?
```
Sin unicidad nueva (el mismo documento puede repetirse en acudientes
distintos, y el mismo acudiente puede aparecer en varios estudiantes). El
`acudienteEstudianteBodySchema` (`src/lib/schemas/index.ts:255`) y
`acudienteUpdateBodySchema` (`:172`) ganan los dos campos opcionales,
validando `tipoDocumento` contra el catálogo activo (patrón profesor).
UI: `SeccionAcudientes.tsx:380-410` gana dos campos etiquetados con
"(opcional)". `WizardUnificado.tsx` (`tipos.ts:9`) también extiende
`AcudienteForm` — respeta la promesa de que el wizard sigue funcionando.

**Rationale**: mockup 1.6 lo pide opcional; el brief D-acud lo cataloga
como aditivo.

## R10 · OnboardingColegio apagado, no borrado

**Decision** (D-2): no se llama desde ningún dashboard ni layout;
`OnboardingModal.tsx` no se monta (comentario "APAGADO SPEC-344 · el camino
guiado reemplaza este mecanismo. Reversible: revertir este commit."); modelo
y endpoints se conservan. Ficha en `deuda-tecnica.md` (o en el cierre.md)
lista el archivo y el patrón que se apagó.

**Rationale**: nada-se-borra + reversibilidad. Si Jelkin decide volver a
onboarding persistente, un `git revert` del commit restaura.

## R11 · Excel de profesores fresco, con `bc49277fc` como referencia (matiz CEO)

**Decision**: escribir `src/lib/colegio/carga-profesores/{parser,validator,
importer}.ts` desde cero contra `main` actual, leyendo `bc49277fc` línea por
línea SOLO como fuente de las columnas y las reglas de validación (nombres
canónicos, `tipoDocumento` activo, `sexo` M/F/OTRO, año 1900..año actual,
email/telefono ya existentes). Copiar sin auditar violaría 15v5.

Tests obligatorios (Vitest):
- `parser.test.ts` (unit): CSV/XLSX con celdas con comillas, filas vacías,
  BOM, límites.
- `validator.test.ts` (unit): normalización mayúsculas/trim, errores por
  columna.
- `plantilla.test.ts` (integración): consume el endpoint `/plantilla`,
  pasa por el validador, afirma 1 fila válida / 0 errores (FR-026-bis,
  test-candado I-245).
- `confirmar.test.ts` (integración): token single-use, atómico,
  idempotencia, duplicados por documento.

**Rationale**: matiz CEO 03:18 explícito.

## R12 · I-245 · arreglar plantilla de alumnos existente (dentro de 344)

**Decision** (FR-026-ter): agregar `documento_tipo_alumno` y
`documento_numero_alumno` al array `COLUMNAS_PLANTILLA` del endpoint
`src/app/api/colegio/carga/plantilla/route.ts` (junto a las columnas ya
existentes). Ajustar la fila de ejemplo. Añadir un test-candado equivalente:
consume la plantilla emitida y la pasa por `parseArchivoCarga` +
`validarFilasCarga`, afirmando 1 fila válida / 0 errores. Sin este test la
misma desincronización volverá.

**Rationale**: I-245 aún abierta y golpea al primer rector real que intente
carga masiva. La regla del CEO ("se cierra dentro de tu 344") lo mete al
alcance.

## R13 · Actualización de tests del padre (SC-008)

**Decision**: los tests que hoy afirman "SCHOOL_ADMIN nunca lleva pasoCamino
en la cookie" (`sesion-estado-emitter.test.ts:176-183`) se ACTUALIZAN para
reflejar la nueva verdad — SCHOOL_ADMIN ahora sí lleva su paso pendiente. Se
mantiene el test que afirma "roles internos (ADMIN, OPERADOR, COMITE_
VALIDACION) NO llevan `pasoCamino`" (siguen con `null`). Los E2E del padre
(`tests/e2e/camino-padre.spec.ts`) NO se tocan.

**Rationale**: SC-008 exige "los tests existentes de padre pasan verdes sin
modificar"; los que sí se modifican son tests de la CADENA SHARED que hoy
tienen una aserción específica sobre el rol colegio — esa aserción cambia
por diseño y queda documentada como cambio esperado.

## R14 · Migraciones a incluir

1. `TokenRegistro`: `rol RolUsuario @default("PARENT")` — todos los tokens
   existentes quedan como PARENT (correcto, no había otros).
2. `AcudienteEstudiante`: `documentoTipo String?`, `documentoNumero String?`.
3. `Colegio.representanteLegalTipoDoc String?` (opcional; solo si R4
   determina que separar es más limpio; primera iteración concatena).

**Ninguna** migración destructiva. `prisma migrate deploy` en producción
solo agrega columnas nullable + defaults; sin bloqueos.

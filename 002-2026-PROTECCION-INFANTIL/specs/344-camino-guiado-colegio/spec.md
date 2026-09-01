# SPEC-344 · El camino guiado del colegio (A-69 · Fase C1)

**Feature Branch**: `work/pi-SPEC-344-camino-colegio`

**Created**: 01-09-2026

**Status**: IMPLEMENTADO

**Radicado**: A-69 · Brief del CEO 01-09-2026 v1.0 · mockup aprobado v3 (momento 1)

**Impacto en arquitectura:** SÍ.

1. El **guardián del camino** deja de ser exclusivo del padre. Nace el rol
   SCHOOL_ADMIN en la misma cadena: `sesion_estado.pasoCamino` deriva por rol,
   `middleware.ts` decide por rol, y el rebote fail-closed también. Mismo
   mecanismo, cero duplicación.
2. La **invariante cruzada** de guardias (`guardias.ts:245-246`, hoy hardcodea
   `vigencia.PARENT.exentas`) se generaliza a `vigencia[rol].exentas` — sin
   esto, los destinos del camino del colegio pasarían la invariante al arranque
   y producirían el bucle I-25/I-111/I-141 en producción.
3. **Migración aditiva** sobre `Usuario` para el rector (ya tiene los campos:
   documentoTipo/Numero, nombres/apellidos, teléfono) — solo se pueblan; no
   migra columnas nuevas para el rector. Migración aditiva sobre `Colegio`:
   nada nueva. Migración aditiva sobre `AcudienteEstudiante`: `documentoTipo?`,
   `documentoNumero?` (D-acud del brief).
4. **`TokenRegistro` gana columna `rol`** (aditiva) — mismo modelo para padre y
   colegio; `RegistroEnlaceService` se parametriza por rol.
5. **Seed nuevo**: `crearCursosPorDefecto(colegioId, anioLectivo)` — 11 grados
   ("Grado 1º" … "Grado 11º") al crear el colegio. Idempotente.
6. **Candado servidor D3**: `POST/PATCH` de `CursoMateria` rechaza `profesorId`
   nulo/vacío (hoy `String?` en schema); el nullable en Prisma se conserva
   para no romper el histórico. El candado vive en el endpoint, no en el schema.
7. **OnboardingColegio queda inactivo** (persistía "pasoActual" en BD y tenía
   modal paralelo — 2ª fuente de verdad, familia de bugs que
   `estado.ts:2-17` mata). Modelo y modal no se borran (regla nada-se-borra).
8. **Registro público del colegio pasa a enlace**: `/registro-colegio` reusa la
   pantalla del padre con nombre+NIT+correo del rector; el flujo de código de
   6 dígitos sale (SPEC-338 no aplicaba a colegio, era del padre legacy).
9. Dos eventos/plantillas nuevas: `colegio.registro_enlace`,
   `colegio.bienvenida_rector`.

Regenerar `docs/architecture/` y dejar `npm run arch:check` VERDE en el mismo PR.

---

## Contexto (verificado en fuente, `origin/main` = 1e8622383)

El colegio hoy es un frente huérfano: se auto-registra con un código de 6
dígitos (mientras el padre migró a enlace en SPEC-339, mockup 1.1 aprobado
para el colegio), entra directo al dashboard con módulos abiertos y queda
**"gratis para siempre"** — la línea `finServicio: null` en
`src/lib/dal/services/registro-colegio.ts:320` y la rama SCHOOL_ADMIN del
emitter (`sesion-estado-emitter.ts:33-35`) hacen que la vigencia siempre
resuelva `ACTIVA` sin ningún plan elegido. Adicionalmente el schema pinta
`representanteLegalIdentificacion` como no-nulo y el auto-registro lo llena
con el literal `"PENDIENTE"` (`registro-colegio.ts:317`).

Lo que existe hoy y se aprovecha (verificado):

| Pieza | Estado real | Fuente |
|---|---|---|
| Alta individual profesor con todos los campos identidad | Ya funciona | `src/lib/schemas/identidad.ts:19` `profesorBodySchema` |
| Alta estudiante con doc obligatorio | Ya funciona (SPEC-320) | `src/lib/schemas/index.ts:263` + `prisma/schema.prisma:1323-1324` |
| Cursos, materias, vínculo curso↔materia con profesor opcional | Ya funciona | `prisma/schema.prisma:1289`, `src/lib/dal/repositories/curso-materia.ts:55` |
| Planes de colegio (freemium + 3/6/12 meses) sembrados | Ya funciona | `prisma/seed.ts:683-745` |
| Flujo de solicitar plan del colegio | Ya funciona | `src/app/api/colegio/suscripcion/solicitar-plan/route.ts:15` |
| Consentimiento CONVENIO_INSTITUCIONAL | Ya funciona (SPEC-343) | `src/lib/dal/services/consentimiento.ts:26-33`, `src/components/modules/ModalConsentimiento.tsx:58` |
| Mecánica del camino (fuente única, guardián, cookie firmada, rebote) | Ya funciona para PARENT | `src/lib/camino/pasos.ts`, `estado.ts`, `middleware.ts:221-273`, `sesion-estado-emitter.ts:46` |
| Wizard "unificado" (curso+estudiantes+identificadores en 3 pasos) | Ya funciona (fuera del camino) | `src/app/dashboard/colegio/cursos/unificado/**` |
| Modelo `Suscripcion` con `colegioId` | Ya funciona | `prisma/schema.prisma:945` |

Lo que **falta** (verificado, no supuesto):

1. Registro del colegio: sigue con código de 6 dígitos
   (`src/app/registro-colegio/page.tsx:12-112` +
   `src/app/api/auth/verificar/{solicitar,validar,completar}/route.ts`).
2. No hay guardián de camino para SCHOOL_ADMIN: `middleware.ts:221` y
   `middleware.ts:270` filtran por `sesion.rol === "PARENT"`;
   `sesion-estado-emitter.ts:46` deriva `pasoCamino` solo para PARENT.
3. La invariante cruzada de guardias asume PARENT: `guardias.ts:245-246`
   (`vigencia.PARENT.exentas` hardcodeado; comentario explícito
   "Vigencia solo aplica al padre en lo que respecta al camino").
4. `Colegio.representanteLegalIdentificacion` es un único string y el
   auto-registro lo llena con `"PENDIENTE"` (`registro-colegio.ts:317`);
   `representanteLegalTelefono` es nullable y nunca se pide.
5. `AcudienteEstudiante` no tiene tipo/número de documento
   (`prisma/schema.prisma:1344-1361`) — el mockup 1.6 los pide opcionales.
6. `CursoMateria.profesorId` es `String?` nullable
   (`prisma/schema.prisma:1294`); ningún endpoint valida que exista un profesor
   asignado (mockup 1.5 pide "Asigne un profesor para guardar" — D3 del brief).
7. No hay seed de cursos; el rector hoy los crea uno a uno o los importa
   desperdigados en el wizard unificado; el mockup 1.5 quiere los 11 grados
   pre-cargados.
8. La carga por Excel de profesores tiene parser+validator escritos en la rama
   `bc49277fc` (SPEC-335) pero NUNCA llegó a `main` (endpoints y UI faltan).
9. `OnboardingColegio` persiste "pasoActual" en BD y hay un `OnboardingModal.tsx`
   compitiendo con el camino guiado que pide el brief.
10. `/api/auth/logout/route.ts:11-12` no expira `sesion_estado` — la cookie de
    estado sobrevive hasta 5 min tras logout (hoy es inocuo, pero SPEC-344 no
    debe apoyarse en que logout limpie el estado).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El rector entra por enlace, no con un código (Priority: P1)

Un rector deja el NIT del colegio, su nombre y su correo, abre el enlace que le
llega y elige su contraseña. No transcribe nada.

**Why this priority**: es la puerta. El código de 6 dígitos que existe hoy es
la barrera más frecuente de abandono; el padre ya la retiró en A-67.

**Independent Test**: correo/NIT nuevos → enlace → contraseña → cuenta creada
+ correo de bienvenida.

**Acceptance Scenarios**:

1. **Given** un correo y un NIT que no tienen cuenta, **When** el rector los
   deja, **Then** ve la pantalla de aviso con su correo escrito, la nota de
   correo no deseado y el botón de reenviar, y recibe un enlace en su buzón.
2. **Given** el enlace recibido, **When** lo abre, **Then** puede elegir su
   contraseña dos veces con las dos condiciones visibles (8 caracteres ·
   coinciden) y el botón deshabilitado hasta cumplirlas.
3. **Given** la contraseña guardada, **When** termina, **Then** queda con
   sesión iniciada, recibe el correo de bienvenida, y aterriza en el Paso 1
   del camino.
4. **Given** un NIT o un correo que YA están registrados, **When** el rector
   los deja, **Then** ve **exactamente la misma pantalla** que en el escenario
   1 (jamás se confirma existencia en pantalla) y el aviso "ya tienes una
   cuenta con este correo/NIT" le llega al buzón (anti-enumeración por AMBAS
   dimensiones, patrón SPEC-338 heredado).
5. **Given** un enlace ya usado o de más de 24 horas, **When** lo abre,
   **Then** el sistema se lo dice con calma y le ofrece pedir uno nuevo.
6. **Given** el registro de padre en `/registro` (SPEC-339), **When** un padre
   nuevo lo usa, **Then** sigue funcionando exactamente igual — el enlace del
   colegio no lo toca.

---

### User Story 2 — El sistema lleva de la mano al rector y no lo deja saltar pasos (Priority: P1)

El rector recorre cinco pasos —quién responde, plan, profesores, cursos,
estudiantes— con el indicador «Paso N de 5» siempre visible. Los módulos del
colegio no aparecen hasta terminar.

**Why this priority**: es el corazón del brief. Sin el portero, el camino es
una sugerencia y el rector queda a medias.

**Independent Test**: con una cuenta recién creada, intentar entrar por URL
escrita a mano a cualquier módulo del colegio y verificar que el sistema
devuelve al paso pendiente.

**Acceptance Scenarios**:

1. **Given** un rector que no aceptó el convenio, **When** escribe a mano la
   dirección de cualquier módulo del colegio, **Then** el sistema lo devuelve
   al Paso 1.
2. **Given** un rector con convenio aceptado y sin plan (freemium ni
   solicitado), **When** intenta cualquier módulo, **Then** vuelve al Paso 2.
3. **Given** un rector con plan y **ningún** profesor cargado, **When** intenta
   cualquier módulo, **Then** vuelve al Paso 3.
4. **Given** un rector con al menos un profesor y **ningún** curso activo,
   **When** intenta cualquier módulo, **Then** vuelve al Paso 4.
5. **Given** un rector con curso pero **ningún** estudiante en él, **When**
   intenta cualquier módulo, **Then** vuelve al Paso 5.
6. **Given** un rector a mitad del Paso 3, **When** cierra el navegador y
   vuelve horas después, **Then** retoma en el Paso 3 con los profesores que
   ya había cargado.
7. **Given** una llamada de datos (no de pantalla) con el camino incompleto,
   **When** se ejecuta, **Then** responde JSON 403 `{code:"CAMINO_INCOMPLETO",
   redirectTo:"..."}`, nunca una redirección que el navegador no pueda seguir.
8. **Given** un rector en el Paso 2 que elige un plan **pagado** (queda en
   `PENDIENTE_AUTORIZACION`), **When** intenta continuar, **Then** el paso se
   da por cumplido (regla A-67: cualquier suscripción registrada cuenta) y
   sigue al Paso 3 sin bloqueo.
9. **Given** un padre PARENT recorriendo `/camino/**` en paralelo, **When** el
   camino del colegio despliegue, **Then** su recorrido no cambia en ninguna
   pantalla ni ruta.
10. **Given** cualquier otro rol (OPERADOR, COMITE_VALIDACION, ADMIN, PARENT,
    COMITE_CONVIVENCIA), **When** navega, **Then** el guardián del camino del
    colegio no lo toca.

---

### User Story 3 — Paso 1 · Quien responde (Priority: P1)

El rector completa sus datos de identidad (tipo/número de documento, nombres,
apellidos, teléfono) y firma el convenio de tratamiento de datos, todo en el
Paso 1 del camino.

**Why this priority**: quien firma el informe ante la Secretaría (fase C5)
tiene que estar plenamente identificado antes de empezar.

**Independent Test**: cuenta recién creada → llenar 5 campos + aceptar
convenio → paso cumplido.

**Acceptance Scenarios**:

1. **Given** el Paso 1, **When** el rector deja tipo y número de documento,
   nombres, apellidos y teléfono y acepta el convenio (v1.0 público, ya
   desplegado por SPEC-343), **Then** el paso se da por cumplido, la cuenta
   del rector queda con sus datos guardados en `Usuario` y `Colegio` refleja
   los mismos valores para consistencia.
2. **Given** una fila vieja con `representanteLegalIdentificacion: "PENDIENTE"`,
   **When** el rector completa el Paso 1, **Then** el literal se reemplaza por
   el número real y el tipo se guarda en `Colegio.representanteLegalTipoDoc`
   (campo aditivo o mapeo equivalente).
3. **Given** un rector que ya tiene los datos completos (SCHOOL_ADMIN creado
   por admin), **When** entra al camino, **Then** el Paso 1 salta a "cumplido"
   sin volver a pedirle nada — sigue derecho al Paso 2.
4. **Given** el Paso 1 en el navegador, **When** el rector aún no llenó un
   campo obligatorio, **Then** el botón "Continuar" está deshabilitado y el
   campo faltante se nombra explícitamente (no un "hay errores" genérico —
   candado de UX del brief).

---

### User Story 4 — Paso 2 · Plan (Priority: P1)

El rector ve los planes activos de colegio (freemium 30 días destacado + 3/6/12
meses) y un campo de bono. Elige uno y el paso se da por cumplido.

**Why this priority**: cierra el bug D2 de "gratis para siempre" en lo que
respecta al camino — el fix profundo de vigencia queda para otra spec del
brief; en C1 el rector no puede pasar sin elegir plan.

**Independent Test**: activar freemium y ver que el Paso 2 cierra al instante,
sin recargar.

**Acceptance Scenarios**:

1. **Given** el Paso 2, **When** el rector activa la prueba freemium 30 días,
   **Then** el paso cierra al instante (`sellarCookieSesionEstadoEnAccion`
   sella la cookie), sigue al Paso 3 sin recargar ni pasar por "Renovar".
2. **Given** el Paso 2, **When** el rector elige un plan pagado, **Then** la
   suscripción queda en `PENDIENTE_AUTORIZACION` y el paso se cumple igual
   (regla A-67).
3. **Given** un bono válido, **When** el rector lo aplica, **Then** el flujo
   existente `POST /api/pagos/aplicar-bono` (`titularidad: "colegio"`) funciona
   sin cambios.
4. **Given** un rector ya con suscripción registrada (previa o de otro camino),
   **When** entra al camino, **Then** el Paso 2 salta a "cumplido" y sigue.

---

### User Story 5 — Paso 3 · Profesores (individual + Excel) (Priority: P1)

El rector carga a sus profesores uno por uno o cargando una lista desde Excel.
La ficha exige todos los datos de identidad (documento, año de nacimiento,
sexo, teléfono, correo).

**Why this priority**: sin profesores no se pueden asignar materias
(Paso 4-D3), y el mockup 1.4 muestra Excel como opción visible.

**Independent Test**: cargar 1 profesor individual + cargar 5 desde Excel →
Paso 3 cumplido con 6 profesores activos.

**Acceptance Scenarios**:

1. **Given** el Paso 3 sin profesores, **When** el rector agrega un profesor
   individual (endpoint existente `POST /api/colegio/profesores`),
   **Then** aparece en la tabla y el paso se da por cumplido (≥ 1 activo).
2. **Given** el Paso 3, **When** el rector descarga la plantilla de Excel,
   la llena y la sube, **Then** el sistema valida (parser + validator
   rescatados de `bc49277fc` en `src/lib/colegio/carga-profesores/`) y muestra
   "N listos / M con problemas" antes de confirmar (dry-run patrón wizard
   unificado).
3. **Given** una plantilla con 3 filas válidas y 2 duplicadas (mismo documento
   ya registrado), **When** confirma, **Then** se crean solo las 3 nuevas y
   el reporte final nombra qué filas se omitieron y por qué.
4. **Given** una plantilla con un tipo de documento inactivo o con `sexo`
   distinto de M/F/OTRO, **When** valida, **Then** el error señala fila y
   columna con mensaje humano; nada se guarda.
5. **Given** un archivo > 5 MB o con > 2000 filas, **When** intenta subir,
   **Then** el sistema rechaza con el mensaje del parámetro del sistema.
6. **Given** el Paso 3 dentro del camino, **When** el rector se sale al
   dashboard sin cargar profesores, **Then** el guardián lo devuelve al Paso 3
   automáticamente al abrir cualquier módulo.
7. **Given** un rector que descarga la plantilla oficial y la llena
   exactamente como viene (con la fila de ejemplo), **When** la sube a
   `/validar`, **Then** el resultado es "1 fila lista, 0 con problemas" — la
   plantilla es autoconsistente con su validador (test-candado, cierra I-245
   para profesores y aplica el mismo patrón a la carga de alumnos existente).

---

### User Story 6 — Paso 4 · Cursos + materias con profesor obligatorio (Priority: P1)

El rector ve los 11 grados sembrados (Grado 1º a Grado 11º del año lectivo
vigente) y solo tiene que quitar los que no aplica, dividir los que necesita
en A/B, y asignar profesor a cada materia (candado D3: no se guarda una
materia sin profesor).

**Why this priority**: es donde el brief pone la decisión de Jelkin más
fuerte (D3: "toda materia con profesor, sin excepción"); el candado debe
existir aunque `CursoMateria.profesorId` siga `String?` en el schema.

**Independent Test**: crear un colegio nuevo, verificar que los 11 grados
aparecen en el Paso 4 sin digitar; intentar guardar una materia sin profesor y
recibir 400; asignar profesor y verificar 201.

**Acceptance Scenarios**:

1. **Given** un colegio recién creado, **When** el rector abre el Paso 4,
   **Then** ve 11 grados activos ("Grado 1º" … "Grado 11º" del año lectivo
   vigente) sin haber digitado nada.
2. **Given** el Paso 4, **When** el rector inactiva "Grado 1º" y "Grado 2º",
   **Then** desaparecen del listado activo pero quedan como inactivos
   (nada-se-borra) y no vuelven a aparecer al recargar.
3. **Given** el Paso 4, **When** el rector agrega "Grado 7º — B" (dividido),
   **Then** convive con "Grado 7º" (o su renombrado a "A") sin colisiones.
4. **Given** una materia dentro de un curso, **When** el rector intenta
   guardar sin profesor asignado (`profesorId` nulo, vacío o inexistente en
   el tenant), **Then** el endpoint devuelve 400 con "Toda materia debe llevar
   un profesor a cargo" (D3, candado servidor).
5. **Given** el mismo endpoint, **When** el rector asigna un profesor activo
   del mismo colegio, **Then** se guarda 201 (comportamiento actual).
6. **Given** el Paso 4 sin al menos un curso activo, **When** el rector
   intenta continuar, **Then** el paso no se cierra.

---

### User Story 7 — Paso 5 · Estudiantes con acudiente y documento aditivo (Priority: P1)

El rector carga estudiantes del curso seleccionado (individual o vía wizard
unificado existente), con su acudiente (nombre + relación + teléfono/correo,
y ahora tipo/número de documento **opcionales**) y opcionalmente identificadores
de plataformas.

**Why this priority**: cierra el camino; sin estudiantes cargados los avisos
no tienen sujeto.

**Independent Test**: cargar 1 estudiante + 1 acudiente con documento → Paso 5
cumplido.

**Acceptance Scenarios**:

1. **Given** un curso activo, **When** el rector agrega un estudiante con
   todos los campos ya obligatorios (SPEC-320) y un acudiente con documento,
   **Then** el estudiante y el acudiente quedan guardados y el paso cumple.
2. **Given** un acudiente sin documento, **When** el rector no llena
   documentoTipo/documentoNumero, **Then** el alta pasa igual (campos
   opcionales aditivos, no rompe historias existentes).
3. **Given** un acudiente con documento, **When** se guarda, **Then** los
   campos `documentoTipo` y `documentoNumero` quedan persistidos en
   `AcudienteEstudiante` y visibles en la ficha del estudiante.
4. **Given** el wizard unificado existente
   (`/dashboard/colegio/cursos/unificado`), **When** el rector lo usa desde el
   Paso 5, **Then** funciona sin cambios (curso + estudiantes + identificadores
   en una pasada).
5. **Given** al menos un estudiante activo en el colegio, **When** el rector
   termina el Paso 5, **Then** el camino se da por completo, se emite un
   sello (`sellarCookieSesionEstadoEnAccion`) y los módulos abren al instante.
6. **Given** un rector que inactiva su único estudiante después de terminar,
   **When** navega, **Then** el guardián lo devuelve al Paso 5 (el camino no
   se "gana" de por vida, se sostiene — misma regla que el padre con hijos).

---

### User Story 8 — Nada del padre ni de otros roles se rompe (Priority: P1)

Los caminos, guardianes, cookies, tests y rutas existentes del padre (SPEC-339
/ A-67) y de los otros roles (OPERADOR, COMITE_VALIDACION, ADMIN,
COMITE_CONVIVENCIA) siguen funcionando exactamente igual.

**Why this priority**: el brief lo pide explícitamente ("los guardias comparten
middleware — enumerá callsites 22v5"); una regresión en el padre borra el
avance de A-67.

**Independent Test**: los tests unit + integration + journeys + E2E del padre
y de los roles no-colegio pasan verdes sin modificar; la enumeración 22v5 de
callsites de la cadena queda documentada en el PR.

**Acceptance Scenarios**:

1. **Given** un padre recorriendo `/camino/**` (los cuatro pasos), **When** se
   desplega esta spec, **Then** su recorrido, sus rutas, su cookie, su
   emisor y sus tests siguen idénticos.
2. **Given** el test `sesion-estado-emitter.test.ts:176-183` (SCHOOL_ADMIN
   con `pasoCamino: null`), **When** se ejecuta con el nuevo emisor,
   **Then** se ACTUALIZA para reflejar que SCHOOL_ADMIN ahora sí porta
   `pasoCamino` cuando el camino está incompleto — la actualización queda
   documentada como cambio esperado, no como regresión.
3. **Given** las exenciones del padre (`vigencia.PARENT.exentas`), **When** se
   agregan las del colegio (`vigencia.SCHOOL_ADMIN.exentas` extendidas),
   **Then** la invariante cruzada `guardias.ts:215-281` verifica ambos roles
   al arranque y falla si algún destino nuevo del camino queda sin exención.
4. **Given** el ratchet estático `scripts/lint/guardia-invariante.ts`,
   **When** corre en CI, **Then** no se degrada.
5. **Given** los E2E `tests/e2e/camino-padre.spec.ts`, **When** corren sin
   modificaciones, **Then** pasan.

---

### Edge Cases

- **Enlace de registro del colegio usado dos veces**: idéntico al del padre
  (SPEC-339), mensaje sereno + ofrece pedir uno nuevo.
- **Enlace vencido (24 h)**: mensaje sereno + reenvío.
- **NIT con formato inválido**: la validación mínima actual (`min(1).max(50)`)
  se conserva; no se agrega validación de dígito de verificación en esta spec
  (fuera de alcance).
- **Rector que llegó por invitación admin** (`estadoActivacion: INVITADO`,
  `tokenInvitacion`): el flujo actual (`/activar`) sigue vivo e intacto; al
  activar entra al camino en el paso pendiente (retroactivo, como el padre).
- **Colegio con `finServicio` no-nulo (creado por admin)**: el guardián del
  camino aplica igual — el bug D2 profundo (vigencia colegio) NO se toca aquí;
  queda para otra spec del brief.
- **SCHOOL_ADMIN cuyo `finServicio` venció**: el guardián de vigencia manda
  al `/dashboard/colegio/suscripcion`, el del camino no lo pisa (mismo
  contrato que A-67 con el plan del padre).
- **`COMITE_CONVIVENCIA`**: NO entra al camino guiado (comparte tenant con el
  colegio pero es cuenta compartida del comité, no del rector). Explícito en
  el emitter y en el middleware.
- **Concurrencia**: dos ventanas del rector en el mismo colegio no deben
  producir estados inconsistentes; el sellado idempotente ya lo cubre.
- **Cookie stale post-deploy**: el `pasoCamino` extendido con valores del
  colegio invalida cookies vivas de rectores actuales — al primer rebote
  fail-closed re-sellan (costo transitorio aceptable, ya pasó con SPEC-339).
- **Logout no borra `sesion_estado`**: se corrige en esta spec (agregar
  expiración de la cookie al endpoint de logout — patrón A-67 lo dejó
  pendiente, hoy es inocuo pero SPEC-344 no se apoya en que sobreviva).

---

## Requirements *(mandatory)*

### Functional Requirements

**Registro por enlace del colegio**

- **FR-001**: El sistema DEBE permitir que un rector solicite el registro del
  colegio dejando **correo, nombre del colegio y NIT**, y DEBE enviarle un
  **enlace** de un solo uso con vencimiento de 24 horas.
- **FR-002**: El sistema DEBE conservar anti-enumeración por **ambas**
  dimensiones — correo Y NIT. La respuesta en pantalla es idéntica en las
  cuatro combinaciones (correo/NIT nuevos, correo existente, NIT existente,
  ambos existentes). En los tres casos donde algo ya existe, el correo "ya
  tienes una cuenta con este correo/NIT" viaja al buzón del correo
  registrado. Patrón SPEC-338 aplicado a las dos dimensiones.
- **FR-003**: El sistema DEBE mostrar una pantalla intermedia que nombre el
  correo, advierta sobre correo no deseado y ofrezca reenviar / cambiar correo.
- **FR-004**: Al abrir el enlace, el sistema DEBE pedir la contraseña dos
  veces con las dos condiciones visibles y mantener el botón deshabilitado
  hasta cumplirlas.
- **FR-005**: Al guardar la contraseña, el sistema DEBE crear el `Tenant` +
  `Colegio` + `Usuario SCHOOL_ADMIN` (patrón `crearColegioMinimo` existente),
  iniciar sesión, sellar la cookie de estado y enviar el **correo de
  bienvenida al rector**.
- **FR-006**: El enlace DEBE quedar inservible tras el primer uso y tras su
  vencimiento; ambos casos DEBEN ofrecer pedir uno nuevo.
- **FR-007**: El registro por **enlace del padre DEBE seguir funcionando
  exactamente igual** (SPEC-339 intacta).
- **FR-008**: El registro por código de 6 dígitos del colegio DEBE retirarse
  (mockup 1.1 aprobado); el modelo `CodigoVerificacion` se conserva por si
  otro flujo lo necesita.

**El camino y su portero**

- **FR-009**: El sistema DEBE definir el camino del colegio como cinco pasos
  ordenados: (1) rector, (2) plan, (3) profesores, (4) cursos, (5)
  estudiantes.
- **FR-010**: El sistema DEBE impedir el acceso a cualquier módulo del colegio
  mientras el camino esté incompleto, incluso cuando la dirección se escribe
  a mano, devolviendo al rector al paso pendiente de menor número.
- **FR-011**: El sistema DEBE retomar el camino en el paso pendiente cuando el
  rector lo abandona y vuelve, conservando lo ya cargado.
- **FR-012**: El sistema DEBE reflejar el avance **al instante** al completar
  cada paso, sin exigir recarga; las server actions DEBEN llamar
  `sellarCookieSesionEstadoEnAccion` (candado 26/I-227).
- **FR-013**: Las llamadas de datos bloqueadas por el portero DEBEN responder
  JSON 403 con `{code:"CAMINO_INCOMPLETO", redirectTo}`, nunca con una
  redirección que el navegador no pueda seguir.
- **FR-014**: El portero del camino del colegio DEBE aplicar solo al rol
  SCHOOL_ADMIN, y NO DEBE alterar los porteros existentes de consentimiento,
  cambio de contraseña ni vigencia. El COMITE_CONVIVENCIA NO entra al camino.
- **FR-015**: Cada pantalla del camino DEBE mostrar el indicador «Paso N de 5»,
  una sola cosa por pantalla, y anunciar qué sigue.
- **FR-016**: `/dashboard/colegio/reportar`, `/mis-reportes` del colegio (si
  existieran en esta fase) y `/api/reportes` DEBEN estar exentos del camino,
  siguiendo el precedente del padre: reportar nunca se bloquea.

**Paso 1 · Quién responde (rector)**

- **FR-017**: El sistema DEBE exigir tipo y número de documento, nombres,
  apellidos y teléfono del rector, y la aceptación del convenio (v1.0
  público, SPEC-343).
- **FR-018**: Los datos del rector DEBEN persistir en `Usuario` (patrón
  A-67); `Colegio` DEBE reflejar `representanteLegalNombre` y
  `representanteLegalIdentificacion` con los valores del Usuario para
  consistencia. Si `representanteLegalTelefono` no estaba, se llena.
- **FR-019**: La migración DEBE retro-llenar `representanteLegalIdentificacion`
  cuando el valor actual sea el literal `"PENDIENTE"`, tomando el valor real
  cuando el rector completa el Paso 1. Ninguna fila viva se pierde.
- **FR-020**: La validación del formulario DEBE nombrar el campo faltante
  (mensaje humano; no "hay errores" genérico) — mismo criterio del brief §0.

**Paso 2 · Plan**

- **FR-021**: El sistema DEBE mostrar únicamente los planes de colegio activos
  (`listarPlanesActivosPorTitular("COLEGIO")`), con freemium 30 días destacado
  y el campo de bono.
- **FR-022**: El sistema DEBE ofrecer al rector activar el freemium en un
  clic (nuevo endpoint `POST /api/colegio/suscripcion/activar-freemium`
  espejo del del padre, o reuso del servicio compartido) — hoy no existe.
- **FR-023**: Al elegir cualquier plan (freemium activado o pagado en
  `PENDIENTE_AUTORIZACION`), el Paso 2 DEBE cerrar al instante y sellar la
  cookie.
- **FR-024** (D2 · puente barato): Elegir plan en el Paso 2 DEBE escribir
  `Colegio.finServicio` con la ventana correspondiente, usando el mecanismo
  A-64 que ya existe (`calcularFinServicio(inicio, tipoPeriodo)` de
  `src/lib/pagos/vigencia-*`):
  - Prueba institucional (freemium 30 días): `finServicio = hoy + duración
    freemium colegio` (parametrizable, sembrado en 30 días).
  - Plan pagado (`PENDIENTE_AUTORIZACION`): `finServicio = hoy + duración
    del plan` (según `Plan.duracion`).
  Con esto un colegio nuevo deja de quedar "gratis para siempre" sin que se
  refactorice la fuente de vigencia. La unificación profunda (vigencia colegio
  ← Suscripción en vez de `Colegio.finServicio`) queda para otra spec del
  brief.

**Paso 3 · Profesores**

- **FR-025**: El sistema DEBE reusar el endpoint existente
  `POST /api/colegio/profesores` para alta individual, con todos los campos
  obligatorios actuales.
- **FR-026**: El sistema DEBE ofrecer carga por Excel de profesores:
  (a) `GET /api/colegio/carga-profesores/plantilla` — descarga CSV/XLSX;
  (b) `POST /api/colegio/carga-profesores/validar` — dry-run;
  (c) `POST /api/colegio/carga-profesores/confirmar` — token firmado
  single-use, patrón `/api/colegio/carga/{validar,confirmar}`.
  Parser y validator SE ESCRIBEN FRESCOS contra `main` actual y con su suite
  completa (unit + integración). El commit `bc49277fc` de SPEC-335 sirve como
  **referencia de columnas y forma**, no como rescate — el código traído se
  lee línea por línea como código ajeno (candado 15v5).
- **FR-026-bis** (I-245): La plantilla emitida por
  `GET /api/colegio/carga-profesores/plantilla` DEBE incluir TODAS las
  columnas obligatorias del validador (nombre, apellidos, tipo_documento,
  numero_documento, anio_nacimiento, sexo, email, telefono) + una fila de
  ejemplo válida. Un test unit-integration DEBE consumir la respuesta del
  endpoint, pasarla por `validarFilasProfesores`, y afirmar 1 fila válida /
  0 errores. Sin este test la plantilla puede desincronizarse en silencio.
- **FR-026-ter** (I-245 · arreglar plantilla de alumnos existente): la
  misma cirugía DEBE aplicarse a la plantilla oficial de alumnos hoy en
  `src/app/api/colegio/carga/plantilla/route.ts`, que hoy omite
  `documento_tipo_alumno` / `documento_numero_alumno` (obligatorios desde
  SPEC-320). Un test-candado equivalente afirma que su plantilla + fila
  ejemplo pasa su propio validador con 1 fila válida / 0 errores. Cierra
  I-245 dentro del alcance de SPEC-344.
- **FR-027**: El Paso 3 se DEBE dar por cumplido con al menos un profesor
  activo en el colegio.

**Paso 4 · Cursos + materias (D3, D5)**

- **FR-028**: Al crear un colegio, el sistema DEBE sembrar 11 cursos activos
  ("Grado 1º" … "Grado 11º") con el año lectivo del sistema al momento de
  crear (`crearCursosPorDefecto(colegioId, anioLectivo)`), idempotente.
- **FR-029**: El Paso 4 se DEBE dar por cumplido con al menos un curso activo
  (los 11 sembrados cumplen esta condición desde el arranque; se admite que
  el rector los inactive todos, en ese caso vuelve al Paso 4).
- **FR-030**: El endpoint `POST /api/colegio/cursos/[id]/materias` DEBE
  rechazar con 400 cualquier intento de crear un vínculo sin
  `profesorId` (nulo, vacío o inexistente en el tenant), con el mensaje
  "Toda materia debe llevar un profesor a cargo" (D3 del brief). El schema
  Prisma NO se migra — el candado vive en el endpoint y en el repo
  (`curso-materia.ts:55`).
- **FR-031**: El sistema DEBE ofrecer una operación de reasignación de
  profesor en una materia existente (hoy la única forma es DELETE + POST);
  puede ser `PATCH /api/colegio/cursos/[id]/materias/[materiaId]` con
  `{profesorId}` (aditivo).

**Paso 5 · Estudiantes + acudiente doc opcional**

- **FR-032**: El Paso 5 se DEBE dar por cumplido con al menos un estudiante
  activo (`Estudiante.estado === "activo"`) en el colegio.
- **FR-033**: El modelo `AcudienteEstudiante` DEBE ganar campos aditivos
  `documentoTipo String?` y `documentoNumero String?`; sin restricción de
  unicidad. Los endpoints existentes (`POST/PATCH /api/colegio/alumnos/[id]/
  acudientes/**`) DEBEN aceptar los campos opcionales.
- **FR-034**: El sistema DEBE reutilizar el wizard unificado existente
  (`/dashboard/colegio/cursos/unificado`) como una opción visible dentro del
  Paso 5; el flujo funciona sin cambios más allá del formulario del acudiente.

**Guardián y cookie (cadena compartida)**

- **FR-035**: `sesion-estado-emitter.ts:46` DEBE derivar `pasoCamino` para
  SCHOOL_ADMIN mediante un `derivarPasoPendienteColegio(usuarioId)` nuevo en
  `src/lib/dal/services/camino/estado-colegio.ts`, sin persistir la
  columna (regla estado.ts:2-17: nada de segundas fuentes de verdad).
- **FR-036**: `src/lib/camino/pasos.ts` DEBE extender los valores de camino
  para incluir los del colegio, discriminando por rol. Se conservan los tipos
  Edge-safe (cero Prisma).
- **FR-037**: `middleware.ts:221` y `middleware.ts:270` DEBEN aceptar
  `sesion.rol === "PARENT" || sesion.rol === "SCHOOL_ADMIN"` y despachar al
  `destinoDePaso` correspondiente (registry por rol si es necesario).
- **FR-038**: `guardias.ts:245-246` (invariante cruzada) DEBE generalizarse a
  `vigencia[rol].exentas` — hoy hardcodea PARENT y el comentario admite
  que "vigencia solo aplica al padre en lo que respecta al camino"; con esta
  spec deja de ser cierto.
- **FR-039**: `guardias.ts` DEBE agregar el bloque `camino.exentasColegio` (o
  extender `camino.exentas` con discriminación por rol) para los destinos del
  camino del colegio (`/camino/colegio/**`, endpoints de profesores, cursos,
  materias, estudiantes, suscripción, sesión) y añadirlos a
  `vigencia.SCHOOL_ADMIN.exentas` para respetar la invariante cruzada.
- **FR-040**: `caminoRebote` (hoy una sola ruta) DEBE aceptar rebote por rol
  o mantener `/api/sesion/al-dia` con lógica interna por rol; el endpoint
  `/api/sesion/al-dia` DEBE incluir el rol SCHOOL_ADMIN en su lógica de rebote.

**OnboardingColegio (apagado, no borrado)**

- **FR-041**: El modelo `OnboardingColegio`, sus endpoints
  (`/api/colegio/onboarding`), su modal (`OnboardingModal.tsx`) y su servicio
  (`src/lib/colegio/onboarding.ts`) DEBEN quedar inactivos: no se llaman
  desde ningún dashboard/layout, la fila se conserva por si alguien revierte
  la decisión. La deuda queda documentada.

**Voz, marca y móvil**

- **FR-042**: Todos los textos del camino del colegio DEBEN usar el **usted
  formal Colombia** (voz del colegio, brief §0). Cero voseo, cero rojo,
  cero jerga técnica; el único color de alerta es ámbar.
- **FR-043**: El camino DEBE verse correctamente a 390 px de ancho, sin
  desbordes horizontales.

**Logout**

- **FR-044**: `POST /api/auth/logout` DEBE expirar la cookie `sesion_estado`
  junto con las cookies de sesión (`token` / `__Host-token`) — hoy solo
  expira las dos últimas.

### Key Entities

- **Token de registro (extendido)**: mismo modelo `TokenRegistro` con columna
  aditiva `rol` (default `"PARENT"`) — sirve al padre y al colegio.
- **Colegio (extendido)**: refleja los datos de identidad del rector desde
  `Usuario`; retro-llena `"PENDIENTE"` cuando el rector completa el Paso 1.
- **Acudiente (extendido)**: gana documento opcional (`documentoTipo?`,
  `documentoNumero?`) sin restricciones nuevas.
- **CursoMateria (candado sin schema)**: el vínculo sigue con `profesorId
  String?` en Prisma; el endpoint es quien impone D3.
- **Curso sembrado**: 11 cursos por defecto ("Grado 1º" … "Grado 11º") con el
  año lectivo del sistema, creados al armar el colegio, editables/apagables.
- **Estado del camino del colegio**: el paso pendiente del rector, derivado
  de hechos que ya existen (consentimiento del colegio, perfil del rector,
  suscripción, ≥ 1 profesor activo, ≥ 1 curso activo, ≥ 1 estudiante activo).
  No es un dato nuevo que se pueda desincronizar.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un rector que nunca usó la aplicación completa el camino entero
  (desde dejar el correo hasta ver su dashboard con al menos un estudiante
  cargado) sin transcribir ningún código, en menos de **15 minutos** para un
  colegio pequeño con Excel de profesores.
- **SC-002**: **Ninguna** dirección escrita a mano deja entrar al rector a
  un módulo del colegio con el camino incompleto: 100 % de los intentos
  vuelven al paso pendiente.
- **SC-003**: Un rector que abandona en cualquier paso y vuelve retoma
  exactamente donde quedó, en el 100 % de los pasos.
- **SC-004**: Al completar cada paso los módulos siguientes abren al primer
  intento, sin recargar.
- **SC-005**: Un intento de guardar una materia sin profesor asignado se
  rechaza con 400 y el mensaje del brief D3, en 100 % de los casos.
- **SC-006**: Un colegio nuevo tiene 11 cursos activos disponibles en el
  Paso 4 sin haber digitado nada.
- **SC-007**: Ninguna pantalla del camino del colegio usa voseo, rojo ni
  jerga técnica.
- **SC-008**: El registro y el camino del padre (SPEC-339) funcionan sin
  regresión — los tests existentes de padre pasan verdes sin modificar.
- **SC-009**: La invariante cruzada de guardias verifica **al arranque** que
  ningún destino nuevo del camino del colegio queda sin exención en
  `vigencia.SCHOOL_ADMIN.exentas`.
- **SC-010**: `POST /api/auth/logout` deja el usuario sin `token`,
  `__Host-token` y `sesion_estado` en las cookies de respuesta.
- **SC-011** (I-245): la plantilla oficial de profesores Y la de alumnos, tal
  como las emite el endpoint hoy, pasan sus propios validadores con la fila
  de ejemplo cerrando 1 fila válida / 0 errores. Un test-candado bloquea
  regresiones en el mismo PR y en el CI.

---

## Assumptions

- **A-1**: El convenio institucional público v1.0 (SPEC-343) es el documento
  que firma el rector en el Paso 1. Ninguna nota interna vive en él.
- **A-2**: `crearColegioMinimo` es el punto único donde se siembra el bloque
  de 11 cursos y se dispara el correo `colegio.bienvenida_rector`.
- **A-3**: El wizard unificado existente se conserva como opción del Paso 5;
  no se refactoriza en esta spec.
- **A-4**: Puente barato al D2 en C1: elegir plan en el Paso 2 escribe
  `Colegio.finServicio` usando el mecanismo A-64 ya existente
  (`calcularFinServicio`). Se retira el sentido cosmético del deferral: un
  colegio nuevo deja de quedar "gratis para siempre" al pasar por el camino.
  La unificación profunda (vigencia colegio ← Suscripción) queda para otra
  spec del brief A-69.
- **A-5**: Los eventos `colegio.registro_enlace` y `colegio.bienvenida_rector`
  se emiten por el motor de notificaciones existente (evento + plantilla
  sembrada), no como envíos sueltos — ratchet vigente.
- **A-6**: La estructura de cada pantalla sale del mockup aprobado v3
  (momento 1); el texto se reescribe en usted formal Colombia respetando la
  voz del colegio.
- **A-7**: Quedan fuera de alcance (brief §4 y §2 fases): fase C2 (reporte
  del rector + candado aquí/afuera), fase C3 (caso estilo expediente),
  fase C4 (comité), fase C5 (informe firmado), fase C6 (puesto de mando +
  notificaciones), fase §8 (rojo → ámbar transversal), fase §3 (Dossier de
  cumplimiento), Manual de Convivencia, integraciones SED/ICBF.
- **A-8**: Las migraciones son aditivas y no destructivas; ningún dato
  existente se pierde. La retro-llenada de `"PENDIENTE"` es cambio de valor
  guiado por el propio rector cuando completa el Paso 1 — no una migración
  ciega.
- **A-9**: OnboardingColegio (modelo + endpoints + modal + servicio) queda
  inactivo pero no se elimina; documentado en decisiones para reversibilidad.
- **A-10**: `sellarCookieSesionEstadoEnAccion` (candado 26/I-227) se usa en
  cada server action del camino del colegio que cierra un paso.

---

## Decisiones de Dev PI-2 (01-09-2026 02:38 — reportadas al CEO, no
contradichas)

- **D-1 · Datos del rector en Usuario, reflejo en Colegio**: `Usuario`
  (patrón A-67) es la fuente de verdad de los campos separados
  (documentoTipo/Numero, nombres, apellidos, teléfono).
  `representanteLegalIdentificacion` de Colegio queda como reflejo
  denormalizado para compatibilidad con lo existente; se retro-llena
  cuando el rector completa el Paso 1.
- **D-2 · OnboardingColegio apagado**: 2ª fuente de verdad del "pasoActual"
  persistida en BD + modal paralelo. Es exactamente la familia de bugs que
  `estado.ts:2-17` mata (I-211/I-222/I-224/I-227). Se apaga en favor del
  camino derivado; nada se borra.
- **D-3 · Registro por enlace compartido**: `TokenRegistro` gana columna `rol`
  (default `"PARENT"` para no romper filas vivas); `RegistroEnlaceService` se
  parametriza. El código de 6 dígitos del colegio muere.
- **D-4 · 11 grados sembrados invisibles**: `crearCursosPorDefecto` corre en
  `crearColegioMinimo` (todos los caminos: público + admin). Al llegar al
  Paso 4 el rector ya ve los 11.
- **D-5 · Excel profesores FRESCO en C1 (matiz CEO 03:18)**: parser+validator
  se escriben frescos contra `main` con suite completa; el commit `bc49277fc`
  se lee como referencia de columnas y forma, no como rescate (rama
  pre-muchas-cosas; candado 15v5 línea por línea). Endpoints + UI
  `ImportProfesores.tsx` también frescos.
- **D-6 · Pantallas del camino reusan las de gestión**: `variante="camino"`
  en los componentes existentes (igual que A-67 hizo con `MisHijos` y
  `PerfilPadreForm`). Se evita duplicar UI.
- **D-7 · D2 con puente barato en C1 (cambio CEO 03:18)**: elegir plan en el
  Paso 2 escribe `Colegio.finServicio` con la ventana correspondiente,
  reutilizando `calcularFinServicio` de A-64 (freemium = hoy + 30 días
  parametrizable; pagado = hoy + duración del plan). Se retira mi deferral
  cosmético: un colegio nuevo deja de quedar gratis para siempre al pasar por
  el camino. La unificación profunda (vigencia colegio ← Suscripción) sí
  queda para otra spec.

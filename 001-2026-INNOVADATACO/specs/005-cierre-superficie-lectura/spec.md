# Feature Specification: Cierre de la superficie de lectura de la API

**Feature Branch**: `005-cierre-superficie-lectura` (el trabajo se commitea en la rama
de pruebas `feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-23

**Status**: Draft — pendiente de aprobación por ZEUS (arquitecto) y Jelkin (CEO)

**Input**: Incidencias **I-009** (toda la superficie de lectura de la API es pública) e
**I-008** (no existe `middleware.ts`: las páginas se abren sin sesión), priorizadas por
**D-037** (seguridad antes que RAG). Restricciones de diseño fijadas por ZEUS en el
handoff, no negociables.

## Contexto: la aplicación no tiene puerta

La constitución **§5.1** dice una sola cosa y no admite lectura: *"Rutas públicas:
`POST /api/auth/login`. Todo lo demás requiere sesión."* Hoy el sistema no cumple esa
frase ni de lejos: **la auditoría, los documentos y las licitaciones se leen desde la red
sin presentar credencial alguna**, y las páginas se abren sin sesión, de modo que el
usuario cree haber entrado cuando no hay entrado nadie.

La spec 004 cerró `GET /api/projects` (I-007) y demostró que el defecto no era de una
ruta: era del criterio. Esta spec aplica el mismo criterio a **toda** la superficie
restante y le pone al producto la barrera de páginas que nunca tuvo.

**Por qué ahora y no antes:** el orden lo fijó I-009 y lo confirmó D-037 — cerrar los GET
antes de que la sesión persistiera (I-005) habría dejado la UI devolviendo 401 en todas
las pantallas, porque hoy "funciona" precisamente por ser pública. Con SPEC-004 terminada
la sesión ya persiste, así que la secuencia está desbloqueada.

### Evidencia verificada (2026-07-23, sobre el código y contra el stack vivo)

Sin cookie, contra `http://localhost:5001`:

| Petición | Respuesta observada |
|---|---|
| `GET /api/config/audit?limit=3` | **200** con registros de auditoría reales (`process_end`, ids de documentos, mensajes del worker) |
| `GET /api/documents` | **200** con documentos reales (título, tipo, sector del acto normativo cargado) |
| `GET /api/licitaciones` | **200** |
| `GET /configuracion`, `/projects`, `/` | **200** — las páginas se sirven sin sesión (I-008) |

> Todas las comprobaciones en vivo fueron **de lectura**. Ninguna verificación de esta
> spec escribe en la base del CEO (**D-039**).

### Hallazgo que amplía el alcance de I-009

El barrido de ZEUS contó **12 rutas con `GET` sin `verifyAuth`**. Al leer los mismos
archivos para redactar esta spec aparece que **el agujero no se limita a la lectura**:
en 7 archivos hay además **8 manejadores de escritura o de acción sin verificación de
sesión**. El más grave es `DELETE /api/licitaciones/[id]`: **cualquiera que alcance el
puerto puede borrar una licitación sin autenticarse.**

Cerrar solo los `GET` dejaría el producto en un estado incoherente y peor de explicar:
la lista protegida y el borrado abierto. Por eso esta spec propone cerrar **toda la
superficie**, lectura y escritura, en un solo movimiento. **Es una ampliación del alcance
que ZEUS fijó y requiere su aprobación explícita** (§0.1); si ZEUS decide dejar la
escritura fuera, las historias US-3 y sus FR se retiran sin afectar al resto.

Caso especial dentro del hallazgo: `GET /api/config/models/discover` acepta un parámetro
`baseUrl` y **hace `fetch` a esa URL desde el servidor**, devolviendo el estado y el
cuerpo de la respuesta upstream. Sin sesión, eso es un **sondeo de red interna operable
desde fuera** (SSRF con reflejo de respuesta), no solo una fuga de lectura.

### Inventario completo (verificado archivo por archivo)

**Superficie de lectura — 11 `GET` sin `verifyAuth`** (`projects` ya lo cerró la spec 004,
por eso son 11 de los 12 de I-009):

| # | Ruta | Archivo |
|---|---|---|
| 1 | `GET /api/config/apis` | `src/app/api/config/apis/route.ts:5` |
| 2 | `GET /api/config/audit` | `src/app/api/config/audit/route.ts:4` |
| 3 | `GET /api/config/models` | `src/app/api/config/models/route.ts:8` |
| 4 | `GET /api/config/models/discover` | `src/app/api/config/models/discover/route.ts:20` |
| 5 | `GET /api/config/module-settings` | `src/app/api/config/module-settings/route.ts:6` |
| 6 | `GET /api/documents` | `src/app/api/documents/route.ts:133` |
| 7 | `GET /api/documents/[id]/logs` | `src/app/api/documents/[id]/logs/route.ts:4` |
| 8 | `GET /api/licitaciones` | `src/app/api/licitaciones/route.ts:8` |
| 9 | `GET /api/licitaciones/[id]` | `src/app/api/licitaciones/[id]/route.ts:7` |
| 10 | `GET /api/licitaciones/entidades` | `src/app/api/licitaciones/entidades/route.ts:6` |
| 11 | `GET /api/licitaciones/estados` | `src/app/api/licitaciones/estados/route.ts:6` |

**Superficie de escritura/acción — 8 manejadores sin `verifyAuth`** (el hallazgo):

| # | Ruta | Archivo | Qué permite sin sesión |
|---|---|---|---|
| 12 | `POST /api/documents/search` | `documents/search/route.ts:5` | Buscar en todo el corpus documental |
| 13 | `PATCH /api/licitaciones/[id]` | `licitaciones/[id]/route.ts:44` | Modificar una licitación |
| 14 | `DELETE /api/licitaciones/[id]` | `licitaciones/[id]/route.ts:93` | **Borrar una licitación** |
| 15 | `POST /api/licitaciones/entidades` | `licitaciones/entidades/route.ts:19` | Crear entidades del catálogo |
| 16 | `POST /api/licitaciones/estados` | `licitaciones/estados/route.ts:19` | Crear estados del catálogo |
| 17 | `PATCH /api/config/apis/[id]/toggle` | `config/apis/[id]/toggle/route.ts:5` | Activar/desactivar una API |
| 18 | `POST /api/config/apis/[id]/test` | `config/apis/[id]/test/route.ts:24` | Disparar llamadas salientes |
| 19 | `POST /api/config/models/test` | `config/models/test/route.ts:7` | Disparar inferencia (coste de máquina) |

Total: **19 manejadores en 15 archivos**. Las rutas ya protegidas (`documents` POST/PATCH,
`licitaciones` POST, `projects` GET/POST, `config/models` POST y `[id]` PUT/DELETE,
`config/apis` POST, `config/module-settings` PUT, `research/analyze` POST) **no se tocan**.

### Auditoría de consumidores (restricción de ZEUS, lección de T012)

La tarea T012 de la spec 004 evitó una regresión real: `projects/page.tsx` hacía `.map()`
sobre la respuesta sin validarla y habría quedado en blanco ante un 401. Se repitió el
ejercicio sobre los 11 `GET`, leyendo cada consumidor:

| Consumidor | Rutas que consume | ¿Sobrevive a un 401? |
|---|---|---|
| `src/app/configuracion/page.tsx:150,155,160` | `config/models`, `config/apis`, `config/audit` | ❌ **No.** `setModels(await res.json())` sin comprobar `res.ok`: el objeto de error entra al estado que después se recorre con `.map()`. **Es exactamente el caso de T012, por triplicado** |
| `src/app/configuracion/page.tsx:298` (*Descubrir*) | `config/models/discover` | ✅ Sí — muestra `data.error` como aviso |
| `src/components/configuracion/ParametrizacionTab.tsx:41` | `config/module-settings` | ✅ Sí — `data.settings \|\| []` |
| `src/components/modules/BaseTab.tsx:333,864,1077` | `documents` | ✅ Sí — comprueba `res.ok` |
| `src/components/modules/BaseTab.tsx:348` | `config/models` | ✅ Sí — comprueba `res.ok` |
| `src/components/modules/BaseTab.tsx:1024` | `documents/[id]/logs` | ✅ Sí — `Array.isArray(data) ? data : []` |
| `src/components/modules/BaseTab.tsx:877` | `documents/search` | ✅ Sí — lanza y avisa |
| `src/app/licitaciones/page.tsx:59` | `licitaciones` | ✅ Sí — lanza y pinta el error |
| `src/components/modules/LicitacionesTab.tsx:84-86,427,584,677` | `licitaciones`, `entidades`, `estados` | ✅ Sí — comprueba `res.ok` en todos |
| `src/components/licitaciones/LicitacionForm.tsx:61-62` | `entidades`, `estados` | ✅ Sí — comprueba `res.ok` |
| — | `licitaciones/[id]` (`GET`) | Sin consumidor en la UI (solo se usan su `PATCH` y su `DELETE`) |

**Conclusión operativa:** hay **un** consumidor frágil, `configuracion/page.tsx`, con tres
cargas sin guarda. Blindarlo es requisito de esta spec, no trabajo opcional: sin eso, la
pantalla de configuración se rompe en cuanto expire la sesión con la página abierta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nada se lee sin sesión (Priority: P1)

Como responsable de seguridad, quiero que ninguna ruta de la API entregue datos a quien no
ha iniciado sesión, para que la auditoría, los documentos y las licitaciones dejen de ser
legibles por cualquiera que alcance el puerto.

**Why this priority**: es la exposición viva que motiva la spec. Cada día que sigue
abierta, la información normativa y la trazabilidad de auditoría del producto están
disponibles sin credencial.

**Independent Test**: invocar cada ruta de lectura sin cookie y con cookie válida.

**Acceptance Scenarios**:

1. **Given** una petición sin cookie de sesión, **When** se invoca cualquiera de los 11
   `GET` del inventario, **Then** responde **401** con el cuerpo `{ "error": ... }` del
   contrato único y **no** devuelve dato alguno del recurso.
2. **Given** una petición con cookie inválida, caducada o manipulada, **When** se invoca
   cualquiera de esos `GET`, **Then** responde **401** igual que si no hubiera cookie:
   no existe un estado intermedio.
3. **Given** una sesión válida, **When** se invoca cualquiera de esos `GET`, **Then**
   devuelve exactamente los mismos datos, el mismo formato y el mismo código que hoy:
   **cero regresión funcional**.
4. **Given** un 401, **When** se inspecciona la respuesta, **Then** no contiene detalle
   técnico, ni `err.message`, ni traza (§0.3).
5. **Given** el rechazo por falta de sesión, **When** se observa el servidor, **Then**
   **no** se ha consultado la base de datos ni se ha hecho ninguna llamada saliente: la
   verificación ocurre **antes** de tocar cualquier recurso.

---

### User Story 2 - Las páginas exigen sesión y llevan al login (Priority: P1)

Como CEO, quiero que al abrir una página de la aplicación sin sesión me lleve al formulario
de acceso, para dejar de creer que he entrado cuando no hay ninguna sesión abierta.

**Why this priority**: es el origen exacto de la confusión reportada el 2026-07-23
(*"no me permite ingresar, pero si le doy clic al link automáticamente sí me envía la
sesión"*). No había sesión: la página simplemente no estaba protegida.

**Independent Test**: navegar directo a `/configuracion` sin cookie, y repetir con sesión.

**Acceptance Scenarios**:

1. **Given** un navegador sin cookie de sesión, **When** se solicita `/`, `/configuracion`,
   `/licitaciones`, `/projects` o `/research`, **Then** el navegador termina en la pantalla
   de acceso y **no** llega a renderizarse contenido de la página protegida.
2. **Given** una sesión válida, **When** se solicita cualquiera de esas páginas, **Then**
   se muestran con normalidad: la barrera no estorba a quien sí ha entrado.
3. **Given** una cookie caducada o manipulada, **When** se solicita una página protegida,
   **Then** se trata como si no hubiera sesión (redirección al acceso).
4. **Given** que el usuario venía de una dirección concreta (por ejemplo
   `/licitaciones`), **When** inicia sesión, **Then** vuelve a esa dirección y no a una
   genérica.
5. **Given** una sesión ya iniciada, **When** se solicita la pantalla de acceso, **Then**
   se lleva al usuario a la aplicación en vez de pedirle credenciales otra vez.
6. **Given** una petición a una ruta de la API sin sesión, **When** la atiende la barrera,
   **Then** responde **401 en JSON** y **nunca** una redirección: un `fetch` que recibiera
   el HTML del login lo interpretaría como éxito y rompería la interfaz.
7. **Given** los recursos estáticos y la pantalla de acceso, **When** se solicitan sin
   sesión, **Then** se sirven con normalidad: la barrera no puede impedir que se cargue el
   propio formulario de acceso.

---

### User Story 3 - Nada se escribe ni se dispara sin sesión (Priority: P1)

Como responsable de seguridad, quiero que modificar o borrar datos y disparar acciones con
coste (inferencia, llamadas salientes) exija sesión, para que el sistema no acepte
escrituras anónimas.

**Why this priority**: `DELETE /api/licitaciones/[id]` sin sesión es destrucción de datos
por parte de un anónimo. Es la consecuencia más grave del inventario y no puede quedar
abierta mientras se cierra la lectura.

> **Alcance ampliado**: esta historia excede el encargo literal de ZEUS (los 12 `GET`).
> Se somete a su aprobación por separado; si la rechaza, se retira US-3 con sus FR-013…
> FR-016 y el resto de la spec queda intacto.

**Independent Test**: invocar cada manejador de escritura sin cookie, **contra una base
desechable o con la ruta simulada, nunca contra la base del CEO** (D-039).

**Acceptance Scenarios**:

1. **Given** una petición sin sesión, **When** se invoca cualquiera de los 8 manejadores de
   escritura/acción del inventario, **Then** responde **401** y **no** se produce ningún
   efecto: ni registro creado, modificado o borrado, ni llamada saliente, ni inferencia.
2. **Given** una petición sin sesión a `DELETE /api/licitaciones/[id]`, **When** se
   verifica el estado posterior, **Then** la licitación **sigue existiendo**.
3. **Given** una sesión válida, **When** se invocan esos manejadores, **Then** se comportan
   igual que hoy: cero regresión.
4. **Given** las operaciones de mutación, **When** se completan con sesión, **Then**
   conservan su registro de auditoría actual (§2.5).

---

### User Story 4 - La interfaz aguanta el 401 sin romperse (Priority: P2)

Como usuario, quiero que si mi sesión caduca con la aplicación abierta la pantalla me lo
diga en vez de quedarse en blanco o mostrar un error del navegador.

**Why this priority**: es la contrapartida directa de US-1. Una pantalla que no maneja el
401 es peor que el agujero que se cierra: rompe una funcionalidad que hoy se ve. La
barrera de páginas (US-2) protege la **navegación**, pero no la sesión que expira con la
pestaña abierta: ahí quien recibe el 401 es el código de la pantalla.

**Independent Test**: abrir la pantalla de configuración con sesión válida, invalidar la
sesión y forzar una recarga de datos.

**Acceptance Scenarios**:

1. **Given** la pantalla de configuración, **When** cualquiera de sus tres cargas (modelos,
   APIs, auditoría) recibe un 401, **Then** la pantalla **no** se rompe: muestra listas
   vacías o un aviso legible.
2. **Given** cualquier pantalla que consume rutas ahora cerradas, **When** recibe un 401,
   **Then** no intenta recorrer como lista un cuerpo que no lo es.
3. **Given** una sesión válida, **When** se usan todas las pantallas, **Then** el
   comportamiento es idéntico al actual (verificado pantalla por pantalla, no por
   inferencia).

### Edge Cases

- ¿Qué pasa con una petición cuya cookie existe pero cuyo token está caducado o firmado con
  otra clave? → 401, tratada exactamente igual que la ausencia de cookie. No hay ruta
  "medio autenticada".
- ¿La barrera de páginas puede depender de la base de datos? → **No.** Debe resolverse con
  la credencial que trae la propia petición; si dependiera de la base, cada navegación
  costaría una consulta y una base caída dejaría fuera a todo el mundo.
- ¿Qué pasa si la barrera se aplica también a la pantalla de acceso o a los recursos
  estáticos? → Bucle de redirección infinito. La lista de exclusiones es parte del diseño,
  no un detalle.
- ¿Y si la barrera devuelve una redirección a una llamada de la API? → El `fetch` recibiría
  HTML con código 200 y la interfaz lo tomaría por datos válidos. Para la API, siempre 401
  en JSON.
- ¿Y si mañana se añade una ruta nueva a la API y alguien olvida verificar la sesión? →
  Debe existir una prueba que recorra el árbol de rutas y falle si aparece un manejador sin
  verificación, salvo que esté en una lista de excepciones declarada y justificada. La
  incidencia I-009 ocurrió porque el criterio vivía en la cabeza de quien escribía cada
  ruta, no en la suite.
- ¿`POST /api/auth/logout` debe exigir sesión? → No. Solo borra la cookie; exigir sesión
  para cerrarla no aporta seguridad y complica el caso de la sesión ya caducada. Se declara
  **explícitamente** como excepción para que nadie lo lea como un olvido.
- ¿Qué pasa con `GET /api/config/models/discover` y su parámetro `baseUrl`? → Al exigir
  sesión deja de ser un sondeo de red abierto. El endurecimiento adicional del parámetro
  (lista blanca de destinos) **no** entra aquí: es otro frente.
- ¿Qué pasa si el worker o algún proceso interno consume estas rutas? → Verificado: el
  worker (`scripts/worker.mjs`) usa Prisma directamente y **no** llama a la API por HTTP;
  cerrar las rutas no lo afecta.

## Requirements *(mandatory)*

### Restricciones de ZEUS (no negociables)

- **RZ-1**: verificar el consumidor en la UI **antes** de cerrar cada `GET`, como en T012.
  Una pantalla que no maneje el 401 se queda en blanco: peor que el agujero.
- **RZ-2**: toda ruta tocada lleva **test Vitest** (§0.2) y devuelve el **contrato
  `apiError`** (§0.3).
- **RZ-3** (**D-039**): ninguna verificación que **mute** datos se ejecuta contra la base
  del CEO. Base desechable o transacción con rollback. Leer en vivo sí está permitido.
- **RZ-4**: no se toca el pipeline RAG ni el OCR.

### Functional Requirements

**Cierre de la lectura (US-1)**

- **FR-001**: los 11 manejadores `GET` del inventario MUST verificar la sesión **antes** de
  consultar la base de datos o hacer cualquier llamada saliente, y MUST responder **401**
  sin devolver datos cuando no la haya.
- **FR-002**: la respuesta 401 MUST usar el contrato único de error (`{ error: <mensaje
  legible> }`), sin `err.message` ni detalle técnico (§0.3, spec 002 FR-004/FR-005).
- **FR-003**: con sesión válida, cada uno de esos `GET` MUST devolver **el mismo cuerpo y
  el mismo código** que devuelve hoy: la spec no cambia contratos de datos.
- **FR-004**: el criterio de autenticación MUST quedar **coherente dentro de cada ruta**:
  ningún archivo puede quedar con un método protegido y otro abierto.

**Barrera de páginas (US-2)**

- **FR-005**: MUST existir una barrera de acceso previa a la resolución de las páginas que,
  ante una petición de navegación sin sesión válida, redirija a la pantalla de acceso.
- **FR-006**: la barrera MUST cubrir `/`, `/configuracion`, `/licitaciones`, `/projects` y
  `/research`, y toda página que se añada bajo esas rutas.
- **FR-007**: la barrera MUST excluir la pantalla de acceso, `POST /api/auth/login`,
  `POST /api/auth/logout` y los recursos estáticos del framework (incluido el icono del
  sitio), para no producir bucles de redirección.
- **FR-008**: ante una petición a `/api/**` sin sesión, la barrera MUST NOT redirigir:
  MUST dejar responder a la ruta (o responder ella misma) con **401 en JSON**.
- **FR-009**: la barrera MUST resolver la sesión **sin acceder a la base de datos**,
  usando únicamente la credencial que viaja en la petición.
- **FR-010**: la redirección al acceso MUST conservar la dirección solicitada y, tras un
  inicio de sesión correcto, el usuario MUST volver a ella. Si no había dirección previa,
  vuelve a la página principal.
- **FR-011**: la dirección de retorno MUST ser **interna a la aplicación**; una dirección
  absoluta o externa MUST descartarse y sustituirse por la página principal (evita usar el
  login como trampolín a un sitio de terceros).
- **FR-012**: con sesión válida, solicitar la pantalla de acceso MUST llevar al usuario a
  la aplicación en lugar de mostrar el formulario.

**Cierre de la escritura (US-3 — alcance ampliado, sujeto a aprobación de ZEUS)**

- **FR-013**: los 8 manejadores de escritura/acción del inventario MUST verificar la sesión
  antes de producir cualquier efecto y MUST responder **401** sin producirlo.
- **FR-014**: `DELETE` y `PATCH /api/licitaciones/[id]` MUST rechazar sin sesión **sin
  tocar el registro**.
- **FR-015**: `POST /api/config/models/test` y `POST /api/config/apis/[id]/test` MUST
  rechazar sin sesión **antes** de disparar inferencia o llamadas salientes (además de
  seguridad, es consumo de la máquina compartida — ADR_002).
- **FR-016**: las mutaciones MUST conservar su registro de auditoría actual (§2.5).

**Resiliencia de la interfaz (US-4)**

- **FR-017**: `src/app/configuracion/page.tsx` MUST validar la respuesta de sus tres cargas
  (`:150` modelos, `:155` APIs, `:160` auditoría) antes de volcarla al estado: ante un
  cuerpo que no sea una lista MUST quedar vacío y MUST NOT romper el renderizado.
- **FR-018**: MUST verificarse el resto de consumidores de las rutas cerradas y corregirse
  cualquiera que no tolere un 401. La tabla de auditoría de consumidores de esta spec es el
  punto de partida, no la conclusión: el plan MUST reconfirmarla sobre el código del día.

**Pruebas y regresión**

- **FR-019**: cada manejador cerrado MUST tener prueba Vitest de **401 sin sesión** y de
  **comportamiento con sesión** (§0.2). Los 20 archivos de prueba de rutas ya existen: se
  extienden, no se crean de cero.
- **FR-020**: la prueba de 401 MUST comprobar además que **no se invocó la capa de datos ni
  la llamada saliente** (el patrón `expect(prisma.X.findMany).not.toHaveBeenCalled()` ya
  usado en `projects/route.test.ts`).
- **FR-021**: la barrera de páginas MUST tener prueba propia que cubra: petición sin sesión
  a página protegida, con sesión, a la pantalla de acceso, a un recurso estático y a
  `/api/**`.
- **FR-022**: MUST existir una prueba de **cobertura estructural** que recorra
  `src/app/api/**/route.ts` y falle si algún manejador exportado carece de verificación de
  sesión, salvo los declarados como públicos (`POST /api/auth/login`,
  `POST /api/auth/logout`). Esta prueba es la que impide que I-009 vuelva a ocurrir.
- **FR-023**: la suite MUST seguir ejecutándose **sin base de datos y sin Ollama** y MUST
  NOT bajar de **118** pruebas verdes (línea base medida: 118 en 23 archivos).
- **FR-024**: los cambios MUST respetar los contratos de la spec 002: **cero `any`
  nuevos** y **cero fugas de `err.message`**. El gate de tipado es **`npx tsc --noEmit`**,
  no `npm run build` (fe de erratas del ACTA-002).
- **FR-025**: ningún cambio MUST tocar archivos, contenedores, volúmenes ni puertos de
  `002-2026-PROTECCION-INFANTIL` ni `003-2026-SICOV-OTPC` (ADR_002). El *staging* MUST ser
  **explícito por ruta**: prohibido `git add -A`.

### Key Entities

- **Sesión**: credencial firmada que viaja en la cookie del navegador. Es la única fuente
  de verdad de "quién pide"; su verificación no consulta la base de datos.
- **Rutas públicas**: conjunto **cerrado y declarado** — `POST /api/auth/login`,
  `POST /api/auth/logout`, la pantalla de acceso y los recursos estáticos. Todo lo que no
  esté en esa lista requiere sesión (§5.1).
- **Barrera de acceso**: filtro previo a la resolución de páginas. Decide entre servir,
  redirigir al acceso (navegación) o responder 401 (API).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: los **11** `GET` del inventario responden **401** sin cookie (línea base: los
  11 responden 200; `config/audit` y `documents` con datos reales).
- **SC-002**: `GET /api/config/audit` y `GET /api/documents` sin cookie **no** devuelven
  ni un solo registro (línea base: devuelven la auditoría y los documentos completos).
- **SC-003**: los **11** `GET` con sesión válida devuelven el mismo cuerpo que antes del
  cambio, comprobado ruta por ruta.
- **SC-004**: solicitar `/`, `/configuracion`, `/licitaciones`, `/projects` y `/research`
  sin cookie termina en la pantalla de acceso, sin renderizar la página (línea base: **200**
  con la página completa).
- **SC-005**: solicitar esas mismas páginas **con** sesión válida las muestra con
  normalidad.
- **SC-006**: iniciar sesión desde una redirección devuelve al usuario a la página que
  pidió originalmente.
- **SC-007**: una petición a `/api/**` sin sesión devuelve **401 con cuerpo JSON**; en
  ningún caso una redirección ni HTML.
- **SC-008**: los **8** manejadores de escritura/acción responden 401 sin sesión y **no
  producen efecto** — verificado sin escribir en la base del CEO (D-039).
- **SC-009**: recorrido de las cinco pantallas con sesión válida sin ninguna regresión
  funcional respecto al comportamiento actual.
- **SC-010**: con la sesión invalidada y la pantalla de configuración abierta, recargar sus
  datos no rompe la pantalla (línea base: `.map()` sobre un objeto de error).
- **SC-011**: la prueba estructural de FR-022 pasa y **falla** si se le retira la
  verificación a una ruta cualquiera (comprobación deliberada durante el desarrollo).
- **SC-012**: `npx vitest run` termina en verde **sin base de datos ni Ollama**, con
  **≥ 118** pruebas y al menos una de 401 por manejador cerrado (línea base: 118 en 23
  archivos).
- **SC-013**: `npx tsc --noEmit` termina limpio y `npx eslint src/lib src/app/api` reporta
  **0** errores `no-explicit-any` (línea base: ambos limpios tras SPEC-004; no se admite
  retroceso).
- **SC-014**: `git diff --cached --name-only` del commit contiene **solo** rutas bajo
  `001-2026-INNOVADATACO/`.
- **SC-015**: los puertos 5005/5433/5010/5434 permanecen sin cambios y sus contenedores
  intactos.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita aquí |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/005-cierre-superficie-lectura/` con spec, plan y tasks |
| 2 | Código subido a la **rama de pruebas** | Commits convencionales scopeados a `001-2026-INNOVADATACO/`, en **`feature/001-scaffolding`**, con **push en el mismo acto**. `main` es producción y solo recibe merges de liberación (METODOLOGIA §10) |
| 3 | Pruebas escritas y pasando | SC-011, SC-012: suite verde sin infraestructura, con 401 por manejador y prueba estructural anti-regresión |
| 4 | Despliegue accesible y probable | SC-004, SC-005, SC-009: el CEO entra por el login, navega las cinco pantallas y todo funciona igual que antes — pero ahora hay que entrar |
| 5 | Revisión de arquitectura de ZEUS | Verificación de RZ-1…RZ-4 e inventario cerrado al 100 % |

## Assumptions

- La sesión ya persiste en el navegador (SPEC-004, I-005 resuelta): sin eso, esta spec
  dejaría al CEO fuera de su propia aplicación. **Es la precondición de todo el trabajo.**
- El único rol relevante hoy es "hay sesión / no hay sesión". El control por rol (RBAC,
  `403`) está reservado para el futuro en §2.4 y **no** entra aquí: cerrar por sesión es
  independiente y no lo estorba.
- Las pruebas siguen siendo unitarias con simulaciones (spec 002): no introducen dependencia
  de base de datos ni de Ollama, lo que además satisface D-039 sin esfuerzo extra.
- El inventario de 19 manejadores se midió el 2026-07-23 sobre el código de la rama de
  pruebas; el plan lo reconfirma antes de implementar (§1.1: verdad sobre el estado del
  código).
- Esta spec **no se implementa** hasta ser aprobada por ZEUS y Jelkin (§0.1). La ampliación
  de alcance a la escritura (US-3) requiere aprobación explícita y separada.

## Out of Scope

- **Control por rol (RBAC) y respuestas 403.** Aquí solo se distingue sesión de ausencia de
  sesión.
- **Endurecer el parámetro `baseUrl` de *Descubrir*** con lista blanca de destinos: exigir
  sesión cierra el acceso anónimo; el resto es otro frente.
- **Rate limiting** (§5.4) y expiración/renovación de sesión más allá de lo que ya existe.
- **Migrar los `any` restantes de los componentes `.tsx`** (deuda conocida, D-016), incluido
  el `catch (err: any)` de `licitaciones/page.tsx`. Solo se toca lo que exige FR-017.
- **Pipeline RAG (spec 003) y OCR (D-025).** RZ-4.
- Rediseñar la pantalla de acceso o el flujo de autenticación (sigue siendo JWT en cookie
  con `jose`, §1.3).
- Cualquier cambio en 002-Protección Infantil o 003-SICOV.

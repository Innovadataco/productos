# Feature Specification: Cierre de la superficie de la API y protección de páginas

**Feature Branch**: `005-cierre-superficie-lectura` (el trabajo se commitea en la rama
de pruebas `feature/001-scaffolding`; no se abren ramas por feature — AGENTS.md)

**Created**: 2026-07-23 · **Revisada tras la aprobación de ZEUS**: 2026-07-23

**Status**: **Approved por ZEUS** (2026-07-23, sobre `62736c2d`, con la ampliación de
alcance aprobada y repriorizada). No se implementa hasta que ZEUS apruebe el plan.

**Input**: Incidencias **I-010** (escritura anónima: borrado y modificación sin sesión —
**crítica**), **I-009** (toda la superficie de lectura es pública) e **I-008** (no existe
`middleware.ts`). Decisiones vinculantes: **D-037** (seguridad antes que RAG) y **D-040**
(la escritura se cierra primero: un borrado anónimo destruye, una lectura expuesta solo
revela).

## Contexto: la aplicación no tiene puerta

La constitución **§5.1** dice una sola cosa y no admite lectura: *"Rutas públicas:
`POST /api/auth/login`. Todo lo demás requiere sesión."* Hoy el sistema no cumple esa
frase ni de lejos: **cualquiera que alcance el puerto puede borrar una licitación,
disparar inferencia en la máquina compartida y leer la auditoría y los documentos**, y las
páginas se abren sin sesión, de modo que el usuario cree haber entrado cuando no ha
entrado nadie.

La spec 004 cerró `GET /api/projects` (I-007) y demostró que el defecto no era de una
ruta: era del criterio. Esta spec aplica el mismo criterio a **toda** la superficie
restante y le pone al producto la barrera de páginas que nunca tuvo.

**Por qué ahora y no antes:** cerrar la API antes de que la sesión persistiera (I-005)
habría dejado la UI devolviendo 401 en todas las pantallas, porque hoy "funciona"
precisamente por ser pública. Con SPEC-004 terminada la sesión ya persiste y la secuencia
está desbloqueada (D-037).

**Por qué en este orden:** **D-040**. La escritura va primero porque su daño es
irreversible; la lectura, después; la barrera de páginas, al final, porque es la capa que
mejora la experiencia pero no es la que contiene el daño.

### Evidencia verificada (2026-07-23)

Sin cookie, contra `http://localhost:5001`:

| Petición | Respuesta observada | Verificó |
|---|---|---|
| `DELETE /api/licitaciones/<id-inexistente>` | **404 "no encontrada"** — la petición **llega a la base de datos**: con un id real, **borra** | ZEUS |
| `GET /api/config/models/discover?baseUrl=…` | **200**, con el servidor haciendo `fetch` a una URL arbitraria y devolviendo estado y cuerpo upstream | ZEUS |
| `GET /api/config/audit?limit=3` | **200** con registros de auditoría reales (`process_end`, ids de documentos, mensajes del worker) | ODIN |
| `GET /api/documents` | **200** con documentos reales (título, tipo y sector del acto normativo cargado) | ODIN |
| `GET /api/licitaciones` | **200** | ODIN |
| `GET /configuracion`, `/projects`, `/` | **200** — las páginas se sirven sin sesión (I-008) | ODIN |

> Las comprobaciones de ODIN fueron **solo de lectura**; el `DELETE` se probó contra un
> **id inexistente**, de modo que ninguna verificación de esta spec escribió en la base del
> CEO (**D-039**).

### El hallazgo que reordenó la spec

El barrido de ZEUS contó **12 rutas con `GET` sin `verifyAuth`** (I-009). Al leer los
mismos archivos para redactar esta spec apareció que **el agujero no se limita a la
lectura**: en 7 archivos hay además **8 manejadores de escritura o de acción sin
verificación de sesión**. ZEUS lo verificó en vivo, lo registró como **I-010 (crítica)** y
lo elevó por delante del encargo original en **D-040**.

Caso especial: `GET /api/config/models/discover` acepta un parámetro `baseUrl` y **hace
`fetch` a esa URL desde el servidor**, devolviendo estado y cuerpo de la respuesta upstream.
Sin sesión, eso es un **sondeo de red interna operable desde fuera** (SSRF con reflejo de
respuesta), no una simple fuga de lectura; por eso viaja con el bloque de escritura y no
con el de lectura.

### Inventario completo (verificado archivo por archivo)

**Bloque 1 — superficie de escritura/acción: 8 manejadores sin `verifyAuth`** (I-010):

| # | Ruta | Archivo | Qué permite sin sesión |
|---|---|---|---|
| 1 | `DELETE /api/licitaciones/[id]` | `licitaciones/[id]/route.ts:93` | **Borrar una licitación** |
| 2 | `PATCH /api/licitaciones/[id]` | `licitaciones/[id]/route.ts:44` | Modificar una licitación |
| 3 | `POST /api/licitaciones/entidades` | `licitaciones/entidades/route.ts:19` | Crear entidades del catálogo |
| 4 | `POST /api/licitaciones/estados` | `licitaciones/estados/route.ts:19` | Crear estados del catálogo |
| 5 | `PATCH /api/config/apis/[id]/toggle` | `config/apis/[id]/toggle/route.ts:5` | Activar/desactivar una API |
| 6 | `POST /api/config/apis/[id]/test` | `config/apis/[id]/test/route.ts:24` | Disparar llamadas salientes |
| 7 | `POST /api/config/models/test` | `config/models/test/route.ts:7` | Disparar **inferencia** (coste de la máquina compartida — ADR_002) |
| 8 | `POST /api/documents/search` | `documents/search/route.ts:5` | Buscar en todo el corpus documental |

**Bloque 2 — superficie de lectura: 11 `GET` sin `verifyAuth`** (I-009; `projects` ya lo
cerró la spec 004, por eso son 11 de los 12 del barrido):

| # | Ruta | Archivo |
|---|---|---|
| 9 | `GET /api/config/models/discover` | `config/models/discover/route.ts:20` |
| 10 | `GET /api/config/apis` | `config/apis/route.ts:5` |
| 11 | `GET /api/config/audit` | `config/audit/route.ts:4` |
| 12 | `GET /api/config/models` | `config/models/route.ts:8` |
| 13 | `GET /api/config/module-settings` | `config/module-settings/route.ts:6` |
| 14 | `GET /api/documents` | `documents/route.ts:133` |
| 15 | `GET /api/documents/[id]/logs` | `documents/[id]/logs/route.ts:4` |
| 16 | `GET /api/licitaciones` | `licitaciones/route.ts:8` |
| 17 | `GET /api/licitaciones/[id]` | `licitaciones/[id]/route.ts:7` |
| 18 | `GET /api/licitaciones/entidades` | `licitaciones/entidades/route.ts:6` |
| 19 | `GET /api/licitaciones/estados` | `licitaciones/estados/route.ts:6` |

> `discover` figura en el bloque de lectura por su método, pero se cierra **con el bloque
> de escritura** (US-1): su efecto es una llamada saliente, no una lectura.

Total: **19 manejadores en 15 archivos**. Las rutas ya protegidas (`documents` POST/PATCH,
`licitaciones` POST, `projects` GET/POST, `config/models` POST y `[id]` PUT/DELETE,
`config/apis` POST, `config/module-settings` PUT, `research/analyze` POST) **no se tocan**.

### Auditoría de consumidores (restricción de ZEUS, lección de T012)

La tarea T012 de la spec 004 evitó una regresión real: `projects/page.tsx` hacía `.map()`
sobre la respuesta sin validarla y habría quedado en blanco ante un 401. Se repitió el
ejercicio sobre las 19 rutas, leyendo cada consumidor:

| Consumidor | Rutas que consume | ¿Sobrevive a un 401? |
|---|---|---|
| `src/app/configuracion/page.tsx:150,155,160` | `config/models`, `config/apis`, `config/audit` | ❌ **No.** `setModels(await res.json())` sin comprobar `res.ok`: el objeto de error entra al estado que después se recorre con `.map()`. **Es el caso de T012, por triplicado** |
| `src/app/configuracion/page.tsx:298` (*Descubrir*) | `config/models/discover` | ✅ Sí — muestra `data.error` como aviso |
| `src/app/configuracion/page.tsx:208,229,246,263` | `models/test`, `apis/[id]/toggle`, `apis/[id]/test`, `models/[id]` | ✅ Sí — comprueban `res.ok` y avisan |
| `src/components/configuracion/ParametrizacionTab.tsx:41` | `config/module-settings` | ✅ Sí — `data.settings \|\| []` |
| `src/components/modules/BaseTab.tsx:333,864,1077` | `documents` | ✅ Sí — comprueba `res.ok` |
| `src/components/modules/BaseTab.tsx:348` | `config/models` | ✅ Sí — comprueba `res.ok` |
| `src/components/modules/BaseTab.tsx:877` | `documents/search` | ✅ Sí — lanza y avisa |
| `src/components/modules/BaseTab.tsx:1024` | `documents/[id]/logs` | ✅ Sí — `Array.isArray(data) ? data : []` |
| `src/app/licitaciones/page.tsx:59,114,140` | `licitaciones`, `licitaciones/[id]` (PATCH/DELETE) | ✅ Sí — lanza y pinta el error |
| `src/components/modules/LicitacionesTab.tsx:84-86,133,427,584,600,677,693` | `licitaciones`, `[id]`, `entidades`, `estados` | ✅ Sí — comprueba `res.ok` en todos |
| `src/components/licitaciones/LicitacionForm.tsx:61-62` | `entidades`, `estados` | ✅ Sí — comprueba `res.ok` |
| — | `GET /api/licitaciones/[id]` | Sin consumidor en la UI (solo se usan su `PATCH` y su `DELETE`) |

**Conclusión operativa:** hay **un** consumidor frágil, `configuracion/page.tsx`, con tres
cargas sin guarda. Por instrucción de ZEUS **no se deja para la implementación**: es la
historia **US-2**, con criterios de aceptación propios, y **se corrige antes** de cerrar
los `GET` que consume.

## User Scenarios & Testing *(mandatory)*

> **Orden de entrega fijado por D-040**: escritura (US-1) → resiliencia de la pantalla de
> configuración (US-2) → lectura (US-3) → páginas (US-4). Cada historia es entregable y
> verificable por separado; ninguna depende de que la siguiente exista.

### User Story 1 - Nada se escribe ni se dispara sin sesión (Priority: P1) 🎯 primero

Como responsable de seguridad, quiero que modificar o borrar datos y disparar acciones con
coste (inferencia, llamadas salientes) exija sesión, para que el sistema deje de aceptar
escrituras anónimas.

**Why this priority**: **D-040**. `DELETE /api/licitaciones/[id]` sin sesión es
destrucción de datos por parte de un anónimo, y ZEUS confirmó que la petición llega hasta
la base. Un borrado anónimo destruye; una lectura expuesta solo revela. Es lo primero que
se cierra, incluso antes que el encargo original.

**Independent Test**: invocar cada manejador de escritura sin cookie y con cookie válida
—**contra la suite con la base simulada o contra una base desechable, nunca contra la base
del CEO** (D-039)—; en vivo, solo con identificadores inexistentes.

**Acceptance Scenarios**:

1. **Given** una petición sin sesión, **When** se invoca cualquiera de los 8 manejadores de
   escritura/acción del inventario, **Then** responde **401** y **no** se produce ningún
   efecto: ni registro creado, modificado o borrado, ni llamada saliente, ni inferencia.
2. **Given** una petición sin sesión a `DELETE /api/licitaciones/<id>`, **When** se observa
   el servidor, **Then** **no se consulta la base de datos** — el 401 llega antes que
   cualquier búsqueda del registro (hoy responde 404, prueba de que sí la consulta).
3. **Given** una petición sin sesión a `POST /api/config/models/test` o a
   `POST /api/config/apis/[id]/test`, **When** se atiende, **Then** **no** se dispara
   inferencia ni llamada saliente alguna.
4. **Given** una petición sin sesión a `GET /api/config/models/discover`, **When** se
   atiende, **Then** el servidor **no** hace `fetch` a la URL indicada: el sondeo de red
   anónimo desaparece.
5. **Given** una cookie inválida, caducada o manipulada, **When** se invoca cualquiera de
   esos manejadores, **Then** el resultado es idéntico al de no tener cookie.
6. **Given** una sesión válida, **When** se invocan esos manejadores, **Then** se comportan
   exactamente igual que hoy y conservan su registro de auditoría.

---

### User Story 2 - La pantalla de configuración sobrevive al 401 (Priority: P1) 🎯 antes de cerrar la lectura

Como usuario, quiero que si mi sesión no es válida la pantalla de configuración me lo diga
en vez de quedarse rota, para que cerrar la API no me deje sin la pantalla.

**Why this priority**: es la única pantalla que hoy **no** sobrevive a un 401, y consume
tres de las rutas que US-3 va a cerrar. Cerrar primero y arreglar después reproduce
exactamente el riesgo que T012 evitó en `projects`. Por eso es historia propia, con
criterios propios, y **su verificación es previa** al cierre de esos `GET`.

**Independent Test**: sin cerrar ninguna ruta todavía, simular que las tres cargas
devuelven 401 (o invalidar la cookie y recargar) y comprobar que la pantalla se comporta.

**Acceptance Scenarios**:

1. **Given** la pantalla de configuración, **When** la carga de **modelos** recibe un 401,
   **Then** la pantalla se renderiza sin error, la lista queda vacía y se muestra un aviso
   legible.
2. **Given** la misma pantalla, **When** la carga de **APIs** recibe un 401, **Then** el
   mismo comportamiento.
3. **Given** la misma pantalla, **When** la carga de **auditoría** recibe un 401, **Then**
   el mismo comportamiento.
4. **Given** cualquiera de esas tres cargas, **When** la respuesta no es una lista, **Then**
   **no** se vuelca al estado que después se recorre: ningún `.map()` recibe un objeto de
   error.
5. **Given** una sesión válida, **When** se usa la pantalla, **Then** su comportamiento es
   idéntico al actual: la guarda no cambia nada de lo que hoy funciona.
6. **Given** el resto de consumidores de rutas que se van a cerrar, **When** se reconfirman
   sobre el código del día, **Then** o toleran el 401 o se corrigen con este mismo criterio
   antes de cerrar la ruta que consumen.

---

### User Story 3 - Nada se lee sin sesión (Priority: P1)

Como responsable de seguridad, quiero que ninguna ruta de la API entregue datos a quien no
ha iniciado sesión, para que la auditoría, los documentos y las licitaciones dejen de ser
legibles por cualquiera que alcance el puerto.

**Why this priority**: es el encargo original (I-009) y una exposición viva. Va después de
US-1 por daño relativo (D-040) y después de US-2 por seguridad de la entrega, no por
importancia.

**Independent Test**: invocar cada ruta de lectura sin cookie y con cookie válida.

**Acceptance Scenarios**:

1. **Given** una petición sin cookie, **When** se invoca cualquiera de los 11 `GET` del
   inventario, **Then** responde **401** con el cuerpo `{ "error": … }` del contrato único
   y **no** devuelve dato alguno del recurso.
2. **Given** una cookie inválida, caducada o manipulada, **When** se invoca cualquiera de
   esos `GET`, **Then** responde **401** igual que si no hubiera cookie: no hay estado
   intermedio.
3. **Given** una sesión válida, **When** se invoca cualquiera de esos `GET`, **Then**
   devuelve exactamente el mismo cuerpo, formato y código que hoy: **cero regresión**.
4. **Given** un 401, **When** se inspecciona la respuesta, **Then** no contiene detalle
   técnico, ni `err.message`, ni traza (§0.3).
5. **Given** el rechazo por falta de sesión, **When** se observa el servidor, **Then**
   **no** se ha consultado la base de datos: la verificación ocurre **antes** de tocar
   cualquier recurso.
6. **Given** un archivo de ruta cualquiera, **When** se revisa al terminar, **Then** no
   queda ninguno con un método protegido y otro abierto.

---

### User Story 4 - Las páginas exigen sesión y llevan al login (Priority: P2)

Como CEO, quiero que al abrir una página de la aplicación sin sesión me lleve al formulario
de acceso, para dejar de creer que he entrado cuando no hay ninguna sesión abierta.

**Why this priority**: es el origen exacto de la confusión reportada el 2026-07-23
(*"no me permite ingresar, pero si le doy clic al link automáticamente sí me envía la
sesión"*): no había sesión, la página simplemente no estaba protegida. Va al final porque,
cerradas US-1 y US-3, una página abierta sin sesión ya no entrega datos: molesta y
confunde, pero no expone. Sigue siendo obligatoria: I-008 no se cierra sin ella.

**Independent Test**: navegar directo a `/configuracion` sin cookie, y repetir con sesión.

**Acceptance Scenarios**:

1. **Given** un navegador sin cookie, **When** se solicita `/`, `/configuracion`,
   `/licitaciones`, `/projects` o `/research`, **Then** el navegador termina en la pantalla
   de acceso y **no** se renderiza contenido de la página protegida.
2. **Given** una sesión válida, **When** se solicita cualquiera de esas páginas, **Then**
   se muestran con normalidad: la barrera no estorba a quien sí ha entrado.
3. **Given** una cookie caducada o manipulada, **When** se solicita una página protegida,
   **Then** se trata como si no hubiera sesión.
4. **Given** que el usuario venía de una dirección concreta (por ejemplo `/licitaciones`),
   **When** inicia sesión, **Then** vuelve a esa dirección y no a una genérica.
5. **Given** una dirección de retorno que apunte fuera de la aplicación, **When** se
   procesa, **Then** se descarta y se usa la página principal.
6. **Given** una sesión ya iniciada, **When** se solicita la pantalla de acceso, **Then**
   se lleva al usuario a la aplicación en vez de pedirle credenciales otra vez.
7. **Given** una petición a una ruta de la API sin sesión, **When** la atiende la barrera,
   **Then** responde **401 en JSON** y **nunca** una redirección: un `fetch` que recibiera
   el HTML del login lo interpretaría como éxito y rompería la interfaz.
8. **Given** los recursos estáticos y la pantalla de acceso, **When** se solicitan sin
   sesión, **Then** se sirven con normalidad: la barrera no puede impedir que se cargue el
   propio formulario de acceso.

### Edge Cases

- ¿Qué pasa con una cookie presente pero con token caducado o firmado con otra clave? →
  401, tratada igual que la ausencia de cookie. No hay ruta "medio autenticada".
- ¿La barrera de páginas puede depender de la base de datos? → **No.** Debe resolverse con
  la credencial que trae la propia petición; si dependiera de la base, cada navegación
  costaría una consulta y una base caída dejaría fuera a todo el mundo.
- ¿Qué pasa si la barrera se aplica también a la pantalla de acceso o a los recursos
  estáticos? → Bucle de redirección infinito. La lista de exclusiones es parte del diseño,
  no un detalle.
- ¿Y si la barrera devuelve una redirección a una llamada de la API? → El `fetch` recibiría
  HTML con código 200 y la interfaz lo tomaría por datos válidos. Para la API, siempre 401
  en JSON.
- ¿Y si mañana se añade una ruta nueva y alguien olvida verificar la sesión? → Debe existir
  una prueba que recorra el árbol de rutas y falle si aparece un manejador sin verificación,
  salvo los declarados públicos. I-009 e I-010 ocurrieron porque el criterio vivía en la
  cabeza de quien escribía cada ruta, no en la suite.
- ¿`POST /api/auth/logout` debe exigir sesión? → No. Solo borra la cookie; exigirla para
  cerrarla no aporta seguridad y complica el caso de la sesión ya caducada. Se declara
  **explícitamente** como excepción para que nadie lo lea como un olvido.
- ¿Basta con la barrera de páginas para proteger la API? → No. La barrera es una capa
  añadida; `verifyAuth` en cada ruta sigue siendo **la única fuente de verdad** (§5.1) y es
  lo que la suite verifica.
- ¿Qué pasa con el parámetro `baseUrl` de *Descubrir* una vez cerrado? → Exigir sesión
  elimina el sondeo anónimo. Restringir los destinos con lista blanca **no** entra aquí:
  es otro frente.
- ¿Algún proceso interno consume estas rutas por HTTP? → Verificado: el worker
  (`scripts/worker.mjs`) usa Prisma directamente y **no** llama a la API; cerrarla no lo
  afecta.

## Requirements *(mandatory)*

### Restricciones de ZEUS (no negociables)

- **RZ-1**: verificar el consumidor en la UI **antes** de cerrar cada ruta, como en T012.
  Una pantalla que no maneje el 401 se queda en blanco: peor que el agujero.
- **RZ-2**: toda ruta tocada lleva **test Vitest** (§0.2) y devuelve el **contrato
  `apiError`** (§0.3).
- **RZ-3** (**D-039**): ninguna verificación que **mute** datos se ejecuta contra la base
  del CEO. Base desechable o transacción con rollback. Leer en vivo sí está permitido.
- **RZ-4**: no se toca el pipeline RAG ni el OCR.
- **RZ-5** (**D-040**): la escritura se cierra **antes** que la lectura; las páginas, al
  final.
- **RZ-6**: el manejo del 401 en `configuracion/page.tsx` es **criterio de aceptación
  propio** (US-2), no una tarea de la implementación de US-3.

### Functional Requirements

**Bloque 1 · Cierre de la escritura (US-1) — primero**

- **FR-001**: los 8 manejadores de escritura/acción del inventario MUST verificar la sesión
  **antes** de producir cualquier efecto y MUST responder **401** sin producirlo.
- **FR-002**: `DELETE` y `PATCH /api/licitaciones/[id]` sin sesión MUST rechazar **sin
  consultar la base de datos**; la licitación MUST seguir existiendo e inalterada.
- **FR-003**: `POST /api/config/models/test`, `POST /api/config/apis/[id]/test` y
  `GET /api/config/models/discover` sin sesión MUST rechazar **antes** de disparar
  inferencia o cualquier llamada saliente (seguridad y, además, consumo de la máquina
  compartida — ADR_002).
- **FR-004**: con sesión válida, esos manejadores MUST comportarse igual que hoy y MUST
  conservar su registro de auditoría (§2.5).

**Bloque 2 · Resiliencia de la pantalla de configuración (US-2) — antes de cerrar la lectura**

- **FR-005**: `src/app/configuracion/page.tsx` MUST tratar explícitamente la respuesta no
  autorizada en sus tres cargas (`:150` modelos, `:155` APIs, `:160` auditoría): MUST
  comprobar el resultado antes de volcarlo al estado, MUST dejar la lista vacía si no es
  una lista y MUST mostrar un aviso legible al usuario.
- **FR-006**: FR-005 MUST estar implementado y verificado **antes** de cerrar los `GET` que
  esa pantalla consume (RZ-1, RZ-6). Su verificación MUST poder hacerse de forma
  independiente del cierre de las rutas.
- **FR-007**: el resto de consumidores de las rutas cerradas MUST reconfirmarse sobre el
  código del día; cualquiera que no tolere un 401 MUST corregirse con el mismo criterio
  **antes** de cerrar la ruta que consume. La tabla de auditoría de consumidores de esta
  spec es el punto de partida, no la conclusión.

**Bloque 3 · Cierre de la lectura (US-3)**

- **FR-008**: los 11 manejadores `GET` del inventario MUST verificar la sesión **antes** de
  consultar la base de datos o hacer cualquier llamada saliente, y MUST responder **401**
  sin devolver datos cuando no la haya.
- **FR-009**: la respuesta 401 MUST usar el contrato único de error (`{ error: <mensaje
  legible> }`), sin `err.message` ni detalle técnico (§0.3, spec 002 FR-004/FR-005).
- **FR-010**: con sesión válida, cada `GET` MUST devolver **el mismo cuerpo y el mismo
  código** que devuelve hoy: la spec no cambia contratos de datos.
- **FR-011**: al terminar, el criterio de autenticación MUST ser **coherente dentro de cada
  archivo de ruta**: ninguno puede quedar con un método protegido y otro abierto.

**Bloque 4 · Barrera de páginas (US-4) — al final**

- **FR-012**: MUST existir una barrera de acceso previa a la resolución de las páginas que,
  ante una petición de navegación sin sesión válida, redirija a la pantalla de acceso.
- **FR-013**: la barrera MUST cubrir `/`, `/configuracion`, `/licitaciones`, `/projects` y
  `/research`, y toda página que se añada bajo esas rutas.
- **FR-014**: la barrera MUST excluir la pantalla de acceso, `POST /api/auth/login`,
  `POST /api/auth/logout` y los recursos estáticos del framework (incluido el icono del
  sitio), para no producir bucles de redirección.
- **FR-015**: ante una petición a `/api/**` sin sesión, la barrera MUST NOT redirigir: MUST
  responder **401 en JSON** (o dejar responder a la ruta, que ya lo hace).
- **FR-016**: la barrera MUST resolver la sesión **sin acceder a la base de datos**, usando
  únicamente la credencial que viaja en la petición.
- **FR-017**: la redirección al acceso MUST conservar la dirección solicitada y, tras un
  inicio de sesión correcto, el usuario MUST volver a ella; si no había dirección previa,
  a la página principal.
- **FR-018**: la dirección de retorno MUST ser **interna a la aplicación**; una dirección
  absoluta o externa MUST descartarse y sustituirse por la página principal (evita usar el
  login como trampolín a un sitio de terceros).
- **FR-019**: con sesión válida, solicitar la pantalla de acceso MUST llevar al usuario a
  la aplicación en lugar de mostrar el formulario.

**Bloque 5 · Pruebas y no regresión**

- **FR-020**: cada uno de los 19 manejadores cerrados MUST tener prueba Vitest de **401 sin
  sesión** y de **comportamiento con sesión** (§0.2). Los 20 archivos de prueba de rutas ya
  existen: se extienden, no se crean de cero.
- **FR-021**: la prueba de 401 MUST comprobar además que **no se invocó la capa de datos ni
  la llamada saliente** (patrón `expect(prisma.X.findMany).not.toHaveBeenCalled()` ya usado
  en `projects/route.test.ts`).
- **FR-022**: la barrera de páginas MUST tener prueba propia que cubra: página protegida sin
  sesión, con sesión, pantalla de acceso con y sin sesión, recurso estático y `/api/**`.
- **FR-023**: MUST existir una prueba de **cobertura estructural** que recorra
  `src/app/api/**/route.ts` y falle si algún manejador exportado carece de verificación de
  sesión, salvo los declarados públicos (`POST /api/auth/login`, `POST /api/auth/logout`).
  Esta prueba es la que impide que I-009 e I-010 vuelvan a ocurrir.
- **FR-024**: la suite MUST seguir ejecutándose **sin base de datos y sin Ollama** y MUST
  NOT bajar de **118** pruebas verdes (línea base medida: 118 en 23 archivos).
- **FR-025**: los cambios MUST respetar los contratos de la spec 002 (**cero `any` nuevos**,
  **cero fugas de `err.message`**). El gate de tipado es **`npx tsc --noEmit`**, no
  `npm run build` (fe de erratas del ACTA-002).
- **FR-026**: ningún cambio MUST tocar archivos, contenedores, volúmenes ni puertos de
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

**Escritura (US-1)**

- **SC-001**: los **8** manejadores de escritura/acción responden **401** sin sesión y **no
  producen efecto** (línea base: los 8 responden y ejecutan). Verificado sin escribir en la
  base del CEO (D-039).
- **SC-002**: `DELETE /api/licitaciones/<id>` sin sesión **no consulta la base**: responde
  401 y no 404 (línea base: **404**, o sea que consulta — y con un id real, borra).
- **SC-003**: `GET /api/config/models/discover?baseUrl=…` sin sesión responde 401 **sin
  hacer la llamada saliente** (línea base: 200 con `fetch` a URL arbitraria).
- **SC-004**: con sesión válida, los 8 manejadores se comportan igual que antes y siguen
  registrando auditoría.

**Pantalla de configuración (US-2)**

- **SC-005**: con las tres cargas devolviendo 401, la pantalla de configuración se
  renderiza, muestra listas vacías y un aviso legible (línea base: `.map()` sobre un objeto
  de error).
- **SC-006**: existe prueba o verificación reproducible de SC-005 **anterior** al cierre de
  esos `GET`.

**Lectura (US-3)**

- **SC-007**: los **11** `GET` responden **401** sin cookie (línea base: los 11 responden
  200).
- **SC-008**: `GET /api/config/audit` y `GET /api/documents` sin cookie **no** devuelven ni
  un solo registro (línea base: devuelven auditoría y documentos completos).
- **SC-009**: los **11** `GET` con sesión válida devuelven el mismo cuerpo que antes,
  comprobado ruta por ruta.

**Páginas (US-4)**

- **SC-010**: solicitar `/`, `/configuracion`, `/licitaciones`, `/projects` y `/research`
  sin cookie termina en la pantalla de acceso, sin renderizar la página (línea base: **200**
  con la página completa).
- **SC-011**: esas mismas páginas **con** sesión válida se muestran con normalidad.
- **SC-012**: iniciar sesión desde una redirección devuelve al usuario a la página que pidió
  originalmente; una dirección de retorno externa se descarta.
- **SC-013**: una petición a `/api/**` sin sesión devuelve **401 con cuerpo JSON**; en
  ningún caso una redirección ni HTML.

**Globales**

- **SC-014**: recorrido de las cinco pantallas con sesión válida sin ninguna regresión
  funcional respecto al comportamiento actual.
- **SC-015**: la prueba estructural de FR-023 pasa y **falla** si se le retira la
  verificación a una ruta cualquiera (comprobación deliberada durante el desarrollo).
- **SC-016**: `npx vitest run` termina en verde **sin base de datos ni Ollama**, con
  **≥ 118** pruebas y al menos una de 401 por manejador cerrado (línea base: 118 en 23
  archivos).
- **SC-017**: `npx tsc --noEmit` limpio y `npx eslint src/lib src/app/api` con **0** errores
  `no-explicit-any` (línea base: ambos limpios tras SPEC-004; no se admite retroceso).
- **SC-018**: `git diff --cached --name-only` de cada commit contiene **solo** rutas bajo
  `001-2026-INNOVADATACO/`.
- **SC-019**: los puertos 5005/5433/5010/5434 permanecen sin cambios y sus contenedores
  intactos.

## Definición de terminado

| # | Regla de Oro | Cómo se acredita aquí |
|---|---|---|
| 1 | Spec Kit aplicado | `specs/005-cierre-superficie-lectura/` con spec, plan y tasks |
| 2 | Código subido a la **rama de pruebas** | Commits convencionales scopeados a `001-2026-INNOVADATACO/`, en **`feature/001-scaffolding`**, con **push en el mismo acto y por ODIN** (Metodología §6, regla 2). `main` es producción y solo recibe merges de liberación |
| 3 | Pruebas escritas y pasando | SC-015, SC-016: suite verde sin infraestructura, con 401 por manejador y prueba estructural anti-regresión |
| 4 | Despliegue accesible y probable | SC-010, SC-011, SC-014: el CEO entra por el login, navega las cinco pantallas y todo funciona igual que antes — pero ahora hay que entrar |
| 5 | Revisión de arquitectura de ZEUS | Verificación de RZ-1…RZ-6 e inventario cerrado al 100 % |

## Assumptions

- La sesión ya persiste en el navegador (SPEC-004, I-005 resuelta): sin eso, esta spec
  dejaría al CEO fuera de su propia aplicación. **Es la precondición de todo el trabajo.**
- El único rol relevante hoy es "hay sesión / no hay sesión". El control por rol (RBAC,
  `403`) está reservado para el futuro en §2.4 y **no** entra aquí.
- Las pruebas siguen siendo unitarias con simulaciones (spec 002): no introducen dependencia
  de base de datos ni de Ollama, lo que además satisface D-039 sin esfuerzo extra.
- El inventario de 19 manejadores se midió el 2026-07-23 sobre el código de la rama de
  pruebas; el plan lo reconfirma antes de implementar (§1.1: verdad sobre el estado del
  código).
- El trabajo **no requiere turno de máquina** (ADR_002): no ejecuta inferencia. Al
  contrario, cierra una vía por la que un anónimo podía provocarla.

## Out of Scope

- **Control por rol (RBAC) y respuestas 403.** Aquí solo se distingue sesión de ausencia de
  sesión.
- **Endurecer el parámetro `baseUrl` de *Descubrir*** con lista blanca de destinos: exigir
  sesión cierra el acceso anónimo; el resto es otro frente.
- **Rate limiting** (§5.4) y expiración/renovación de sesión más allá de lo que ya existe.
- **Migrar los `any` restantes de los componentes `.tsx`** (deuda conocida, D-016), incluido
  el `catch (err: any)` de `licitaciones/page.tsx`. Solo se toca lo que exigen FR-005 y
  FR-007.
- **Pipeline RAG (spec 003) y OCR (D-025).** RZ-4.
- Rediseñar la pantalla de acceso o el flujo de autenticación (sigue siendo JWT en cookie
  con `jose`, §1.3); solo se le añade el retorno a la dirección solicitada.
- Cualquier cambio en 002-Protección Infantil o 003-SICOV.

## Historial de la spec

| Versión | Fecha | Cambio |
|---|---|---|
| v1 | 2026-07-23 | Redacción inicial (`62736c2d`). La ampliación a la escritura se propuso aislada en US-3, retirable, en vez de ampliar el alcance por cuenta propia |
| v2 | 2026-07-23 | **Revisión de ZEUS.** Ampliación **aprobada** y elevada a P1 por delante del encargo original (**I-010** crítica, **D-040**); reordenadas las historias a escritura → interfaz → lectura → páginas; el manejo del 401 en `configuracion/page.tsx` pasa a historia propia con criterios de aceptación propios (RZ-6). **Renumeración**: los FR de escritura (antes FR-013…FR-016) son ahora FR-001…FR-004; los de lectura, FR-008…FR-011 |

# Research — Cierre de la superficie de la API y protección de páginas (Fase 0)

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-23

Hallazgos verificados leyendo el código real de la rama de pruebas y probando contra el
stack en ejecución (solo lecturas y un `DELETE` sobre un id inexistente — D-039).

## D-01 — El cierre se hace **ruta por ruta**, no delegado al middleware

- **Decision**: cada uno de los 19 manejadores llama a `verifyAuth()` y responde 401 por su
  cuenta. La barrera de páginas (US-4) es una **capa añadida**, no la que protege la API.
- **Rationale**: tres razones y ninguna es de estilo.
  1. §5.1 dice que `verifyAuth()` es **la única fuente de verdad**; una barrera de rutas
     por patrón es una segunda fuente que puede divergir en silencio (un `matcher` mal
     escrito abre el sistema entero sin que nada falle).
  2. La suite es unitaria y sin infraestructura (spec 002): puede invocar un manejador y
     comprobar su 401, pero no puede levantar el enrutado de Next para comprobar que una
     regla de patrón cubrió una ruta.
  3. La defensa en profundidad es gratis aquí: el coste de `verifyAuth()` es verificar una
     firma en memoria.
- **Alternatives considered**: proteger solo desde el middleware — rechazado por lo
  anterior; el ahorro (19 llamadas de una línea) no compensa que la seguridad dependa de
  una expresión regular.

## D-02 — Un único helper de 401, sin refactor colateral

- **Hecho**: el literal `return NextResponse.json({ error: "No autenticado" }, { status: 401 })`
  está repetido **11 veces** en las rutas ya protegidas.
- **Decision**: añadir `noAutenticado()` a `src/lib/apiError.ts` y usarlo en los **19
  puntos nuevos**. Las 11 apariciones existentes **se dejan como están**.
- **Rationale**: el mensaje al cliente no cambia (`{ error: "No autenticado" }`), así que
  las pruebas existentes siguen valiendo. Migrar las 11 antiguas inflaría el diff con
  cambios que ZEUS tendría que auditar sin que aporten nada a esta spec. Se anota como
  higiene pendiente, no como trabajo de aquí.

## D-03 — La verificación del token se extrae a un módulo compartido

- **Hecho**: `src/lib/auth.ts` usa `cookies()` de `next/headers`, que **no está disponible
  en el middleware**; el middleware lee la cookie de la propia petición
  (`req.cookies.get("token")`).
- **Decision**: extraer la verificación pura a `src/lib/session.ts`:

  ```ts
  export async function verifyToken(token: string | undefined): Promise<Sesion | null>
  ```

  `verifyAuth()` pasa a ser *leer la cookie con `next/headers` + `verifyToken`*, y el
  middleware es *leer la cookie de la petición + `verifyToken`*. **Una sola
  implementación de la verificación**, dos formas de obtener el token.
- **Rationale**: si el middleware verificara por su cuenta, habría dos criterios de
  "sesión válida" y §5.1 dejaría de ser cierta. El resto de `auth.ts` (incluida
  `signToken`) no cambia, y el mock de la suite (`@/test/authMock`) sigue funcionando
  igual porque los tests mockean `@/lib/auth`, no el módulo nuevo.

## D-04 — El secreto se resuelve de forma perezosa y se **falla cerrado**

- **Hecho**: `src/lib/auth.ts:4-7` lanza **al importar** si `JWT_SECRET` falta o mide menos
  de 32 caracteres. En una ruta API eso es un fallo ruidoso y deseable; en el middleware
  reventaría **todas** las peticiones del sitio, incluida la pantalla de acceso.
- **Hecho 2**: `docker-compose.yml:9` inyecta `JWT_SECRET` en tiempo de ejecución al
  servicio de aplicación.
- **Decision**: `session.ts` resuelve el secreto **al usarlo**, no al importarse. Ante
  cualquier fallo (secreto ausente, token corrupto, firma inválida, caducado)
  `verifyToken` devuelve `null` y el llamante trata la petición como **sin sesión**:
  se **falla cerrado**, nunca abierto.
- **Verificación obligatoria durante la implementación**: comprobar que
  `process.env.JWT_SECRET` **llega al middleware en ejecución** dentro del contenedor. Next
  ejecuta el middleware en el runtime *edge* por defecto, donde parte de las variables se
  resuelven en compilación. Plan de contingencia, en este orden:
  1. Declarar el middleware en runtime **Node.js** (soportado por Next 16).
  2. Si tampoco, dejar el middleware comprobando **presencia** de cookie y registrar la
     limitación — la verificación real seguiría estando en cada ruta (D-01), que es la
     autoridad. Esta opción **degrada** el escenario 3 de US-4 (cookie manipulada) y por
     tanto **solo se toma con el visto bueno de ZEUS**.
  3. **Descartado de entrada**: pasar el secreto como argumento de construcción de la
     imagen. Hornear un secreto en la imagen viola §0.4.

## D-05 — Para `/api/**` el middleware responde 401 en JSON, nunca redirige

- **Decision**: el middleware distingue por prefijo: `/api/**` sin sesión → `401` con
  cuerpo JSON; el resto → redirección a la pantalla de acceso.
- **Rationale**: una redirección a una llamada `fetch` se sigue automáticamente y devuelve
  el **HTML del login con estado 200**. Los consumidores lo interpretarían como datos
  válidos: `res.ok` sería `true` y el `await res.json()` reventaría con un error de
  sintaxis en vez de un 401 manejable. Es decir: redirigir la API rompe la interfaz de una
  forma **peor** que el 401 que estamos introduciendo a propósito.

## D-06 — El retorno tras el login viaja en `?next=` y se lee sin `useSearchParams`

- **Decision**: la redirección es `/login?next=<ruta+query solicitada>`. La pantalla de
  acceso lo lee en el manejador de envío con
  `new URLSearchParams(window.location.search).get("next")` y lo pasa por un helper puro
  `destinoSeguro(next)` antes de navegar.
- **Rationale**: `useSearchParams()` obliga a envolver el componente en un límite de
  suspensión para no romper el renderizado estático de Next; leer la query en el manejador
  de envío evita ese arrastre y no cambia nada de la pantalla. El helper puro, además, es
  probable en la suite sin arnés de componentes.
- **`destinoSeguro`**: devuelve el destino solo si empieza por `/` y **no** por `//` ni
  `/\` (que el navegador interpretaría como host externo); en cualquier otro caso, `/`.
  Sin esa validación, la pantalla de acceso sería un trampolín a sitios de terceros
  (FR-018).

## D-07 — La guarda de la pantalla de configuración se extrae a un helper puro

- **Hecho**: `configuracion/page.tsx:150,155,160` hace `setModels(await res.json())` sin
  mirar `res.ok`. Ante un 401 el estado pasa a ser `{ error: … }` y el `.map()` posterior
  rompe la pantalla. Es el caso de T012, por triplicado.
- **Decision**: helper puro en `src/lib/respuestaApi.ts`:

  ```ts
  /** Devuelve el cuerpo solo si la respuesta fue correcta y es una lista; si no, []. */
  export async function listaSegura<T>(res: Response): Promise<{ items: T[]; error: string | null }>
  ```

  Las tres cargas lo usan y muestran el aviso con el `toast()` que la pantalla ya tiene.
- **Rationale**: permite cumplir US-2 con **prueba unitaria en entorno node**, sin montar
  el arnés de pruebas de componentes React — que sigue **fuera de alcance** (spec 004, y
  D-016 dejó los `.tsx` fuera). La verificación visual se hace además a mano (quickstart).
- **Alternatives considered**: prueba de componente con jsdom — el proyecto ya tiene
  `@vitejs/plugin-react` y Testing Library, pero no existe **ni una** prueba `.tsx`;
  estrenar ese arnés dentro de una spec de seguridad mezcla dos frentes.

## D-08 — La prueba estructural invoca, no busca por texto

- **Decision**: una prueba recorre `src/app/api/**/route.ts` con `import.meta.glob`,
  importa cada módulo, invoca **cada manejador HTTP exportado** con la sesión simulada
  como ausente y exige **401**. Las rutas públicas viven en una **lista blanca declarada**
  dentro de la prueba: `POST /api/auth/login` y `POST /api/auth/logout`.
- **Rationale**: un `grep` de `verifyAuth` diría "sí" ante una llamada colocada después de
  la consulta a la base, que es justo el defecto que hay que impedir. Invocar comprueba el
  comportamiento: si el manejador toca la base o parsea el cuerpo antes de verificar, el
  mock lo delata o la llamada falla — en ambos casos la prueba se pone roja.
- **Viabilidad verificada**: los 20 archivos de ruta ya se importan hoy desde sus propias
  pruebas, así que ninguno rompe al importarse. Los manejadores con parámetros se invocan
  con un segundo argumento sintético (`{ params: Promise.resolve({ id: "x" }) }`); los que
  no lo aceptan lo ignoran.
- **Coste de mantenimiento**: añadir una ruta nueva sin sesión pone la suite roja hasta
  que se cierre o se declare pública **con nombre y motivo**. Ese es exactamente el
  control que faltaba: I-009 e I-010 existen porque el criterio vivía en la cabeza de
  quien escribía cada ruta.

## D-09 — Orden de trabajo: escritura → interfaz → lectura → páginas

- **Decision**: D-040 de ZEUS. Primero los 8 manejadores de escritura/acción, después la
  guarda de la pantalla de configuración, después los 11 `GET`, y al final el middleware.
- **Rationale**: un borrado anónimo destruye; una lectura expuesta solo revela. Y la
  guarda va **antes** del cierre que la afecta porque al revés se reproduce el riesgo que
  T012 evitó: cerrar primero deja la pantalla rota en la ventana entre un commit y otro.

## D-10 — `discover` se cierra con el bloque de escritura pese a ser un `GET`

- **Hecho**: `config/models/discover/route.ts:20-25` toma `baseUrl` de la query y hace
  `fetch` contra esa URL desde el servidor, devolviendo estado y cuerpo de la respuesta
  upstream (`Ollama ${res.status}: ${text}`).
- **Decision**: se cierra en el primer bloque, junto con las escrituras.
- **Rationale**: sin sesión no es una fuga de lectura sino un **sondeo de la red interna
  operable desde fuera**, con la respuesta reflejada al atacante. Su daño se parece al de
  una acción, no al de una consulta.
- **Fuera de alcance**: restringir los destinos con lista blanca. Exigir sesión elimina el
  acceso anónimo, que es lo que toca cerrar aquí.

## D-11 — Ningún consumidor interno se rompe

- **Verificado**: `scripts/worker.mjs` accede a la base **directamente con Prisma**; no
  llama a la API por HTTP. Cerrar las rutas no lo afecta.
- **Verificado**: los 41 `fetch` de la interfaz se revisaron uno a uno (tabla de la spec).
  El único frágil ante un 401 es `configuracion/page.tsx`.

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

## D-03 — El middleware **no** verifica el token: comprueba presencia de cookie

> **Revisado el 2026-07-23 por D-041 de ZEUS.** La versión anterior de este apartado
> extraía la verificación a un módulo compartido `src/lib/session.ts` para que el
> middleware pudiera verificar la firma en el borde. **Se retira**: ese módulo solo existía
> para dar servicio al borde y ya no hace falta. Menos código, menos superficie, y el
> secreto de firma no viaja a ningún sitio nuevo.

- **Hecho**: `src/lib/auth.ts` usa `cookies()` de `next/headers`, que **no está disponible
  en el middleware**; el middleware lee la cookie de la propia petición
  (`req.cookies.get("token")`).
- **Decision (D-041)**: el middleware comprueba **solo si la cookie `token` está
  presente**. Si no está, redirige a la pantalla de acceso (o responde 401 en `/api/**`).
  **No** verifica firma, **no** consulta la base, **no** importa `@/lib/auth`.
- **Rationale**: comprobación **optimista** en el borde, verificación **real** en la capa
  de datos. La barrera resuelve un problema de navegación —que el usuario sepa que no ha
  entrado—, no un problema de acceso. El control de acceso es `verifyAuth` en cada ruta
  (D-01), que es justo lo que cierra esta spec, y sigue siendo la única fuente de verdad
  (§5.1). Como efecto colateral, `src/lib/auth.ts` **no se toca**: el mock de la suite y
  las 11 rutas ya protegidas siguen exactamente igual.
- **Condición que sostiene la decisión**: solo es admisible si US-1 y US-3 cierran **todas**
  las rutas. Con una sola abierta, cualquier cookie `token` inventada bastaría para navegar
  hasta ella. Por eso la prueba estructural (FR-023) deja de ser una red de seguridad
  agradable y pasa a ser **el requisito que hace admisible la barrera optimista**.
- **Consecuencia asumida y declarada**: una cookie caducada o manipulada **sí** deja
  renderizar la página; lo que el usuario ve es una pantalla vacía con su aviso, porque
  ninguna de sus peticiones obtiene datos. Es el escenario 3 de US-4 tal como queda escrito.

## D-04 — El secreto de firma no viaja al borde

- **Hecho**: `src/lib/auth.ts:4-7` lanza **al importar** si `JWT_SECRET` falta o mide menos
  de 32 caracteres. En una ruta API eso es un fallo ruidoso y deseable; en el middleware
  habría reventado **todas** las peticiones del sitio, incluida la pantalla de acceso.
- **Hecho 2**: `docker-compose.yml:9` inyecta `JWT_SECRET` en tiempo de ejecución al
  servicio de aplicación; Next resuelve parte de las variables en **compilación** para el
  runtime *edge*, así que no había garantía de que llegara al middleware.
- **Decision (D-041)**: el problema desaparece porque **el borde ya no necesita el
  secreto**. No se declara runtime Node.js para el middleware, no se añade variable nueva y
  no se toca `auth.ts`.
- **Descartado explícitamente**: pasar `JWT_SECRET` como argumento de construcción de la
  imagen. Hornear un secreto en la imagen viola §0.4, y ninguna comodidad lo compensa.

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

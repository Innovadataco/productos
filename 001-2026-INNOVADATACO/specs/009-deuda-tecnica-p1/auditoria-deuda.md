# Auditoría de deuda técnica — hallazgos fuera de la medición de ZEUS

**Fecha**: 2026-07-24 (turno nocturno D-060) · **Autor**: ODIN · **Para**: ZEUS

Barrido en busca de deuda que **no** estuviera en la medición D-063: duplicación,
acoplamientos, validaciones flojas e incumplimientos de la constitución.

**Criterio aplicado** (el del encargo): lo mecánico y de bajo riesgo se **arregla y se prueba**
dentro de SPEC-009; lo que cambia arquitectura o toca muchos archivos se **reporta**, no se
toca.

---

## A · Arreglado esta noche (mecánico, con prueba)

### A-1 · `POST /api/documents` no validaba nada — con riesgo de escritura fuera de `uploads/`

**Severidad: alta.** La puerta de Base Oficial —la ruta más usada del producto— aceptaba
**cualquier** fichero, de **cualquier** tamaño, y lo guardaba como
`${Date.now()}_${file.name}` escribiéndolo con `join(uploadDir, fileName)`. Un nombre con
`../` habría escrito **fuera** de `uploads/`.

Lo llamativo es que la validación correcta ya existía en el proyecto: la escribió la spec 006
para el expediente de oportunidades, y su propio plan anotó que *"la de documents no la
tenía"*. Nunca se cerró el círculo. Y §2.6 nombra **ese archivo exacto** como el sitio donde
validar.

**Hecho**: helpers compartidos en `src/lib/subidaArchivos.ts`, usados por las **dos** rutas
(en vez de duplicar en la que ya la tenía). Solo `.pdf`, máximo 10 MB, nombre saneado.
Comprobado antes de imponer los topes que no rompen nada en uso: los 6 ficheros de `uploads/`
pesan como mucho 730 KB y el input de la UI ya declaraba `accept=".pdf"`. Commit `9f619633`.

### A-2 · §2.6 sin implementar en las dos rutas de texto libre

`POST /api/documents/search` aceptaba una consulta de cualquier longitud y la mandaba a
embeder; `POST /api/research/analyze` aceptaba un texto de cualquier tamaño como prompt. La
constitución fija 500 y 16000 caracteres. **Hecho** con Zod (commit `cc6c352d`).

### A-3 · Un consumidor que la paginación habría dejado corto en silencio

`fetchProcessingDocs` se traía **todos** los documentos para filtrar en cliente los
`queued`/`processing`. Al paginar la ruta habría visto solo la primera página y el panel de
procesamiento se habría quedado corto **sin avisar**. **Hecho**: pide los dos estados al
servidor, que ya sabía filtrar por `status` (commit `c055f754`).

---

## B · Reportado — para que ZEUS lo priorice

### B-1 · `POST /api/documents` descarta `numero` y `fechaExpedicion` en silencio

**Severidad: media (pérdida de dato del usuario).** La ruta leía ambos campos del formulario y
**nunca los persistía**. Quien los escribe al subir un PDF los pierde sin aviso.

**Por qué no lo arreglé**: persistirlos es un cambio de comportamiento sobre Base Oficial y
abre una pregunta de diseño que no me toca: el worker rellena esos campos por análisis
IA, así que hay que decidir **quién gana** — ¿el dato del usuario o el del modelo? Puse la
lectura muerta fuera y dejé el hallazgo comentado en el propio archivo.

### B-2 · `GET /api/projects` sin paginar

§3.3 nombraba `documents` y `licitaciones` (ya paginadas). `projects` tiene el mismo problema
y no estaba en la lista, seguramente porque cuando se escribió la constitución el módulo era
mínimo. Ahora que SPEC-008 lo convierte en gestión PM2, la lista crecerá.

**Por qué no lo arreglé**: paginarla ahora obliga a tocar el listado y el tablero de fases
recién entregados, la misma noche que se entregan. Es trabajo de un rato, pero con revisión
delante. El adaptador del tablero ya lee con `itemsDeCuerpo`, así que **aguantará el cambio**
sin romperse.

### B-3 · Colores de estado duplicados en tres sitios

`estadoColores` vive —con dos paletas distintas— en `LicitacionesTab.tsx:60`,
`LicitacionCard.tsx:36` y ahora `tableroOportunidades.ts:34`. Tres copias que ya divergieron.

**Por qué no lo arreglé**: unificarlas obliga a elegir **una** paleta, y eso cambia el aspecto
de pantallas que el CEO ve. Es una decisión de diseño, no una limpieza. Sugerencia: un único
mapa en `src/lib`, con el acento neutro de fallback que ya usa el tablero (§0.7).

### B-4 · Auditoría ausente en 13 rutas con mutación (§2.5)

§2.5 pide `auditLog` en **toda** mutación de APIs críticas. Tienen auditoría: documentos,
oportunidad (estado, desde SPEC-007) y proyecto (desde SPEC-008). **No** la tienen, entre
otras: `POST /api/licitaciones` (alta de oportunidad), `POST /api/projects` (alta de
proyecto), los catálogos (`estados`, `tipos`, `entidades`), `config/apis`,
`config/module-settings` y el expediente.

**Por qué no lo arreglé**: son 13 rutas; hacerlo bien es decidir **qué** acción y **qué**
metadata registra cada una, y sin ese criterio queda una auditoría ruidosa e inútil. Es un
frente propio, pequeño pero de criterio. Nota: el login/logout tampoco auditan, y ése es el
que yo pondría primero.

### B-5 · `auth/logout` es la única ruta que no usa el contrato `apiError`

Trivial, pero es la excepción que hace dudar de la regla. Va con B-4.

### B-6 · 26 `console.log` en código de producto

§7.2 pide no dejar `console.log` de depuración. Quedan 26, sobre todo en `BaseTab.tsx`
(`[useQueue]`, `[useProcessingDocs]`). Algunos son trazas legítimas de operación, otros
depuración olvidada.

**Por qué no lo arreglé**: separar unos de otros exige leer el flujo de la cola de subida, y
la mayoría están en el componente que RZ-2 protege. Va natural con el troceado.

### B-7 · `alert()` y `confirm()` como interfaz de error (8 + 3 usos)

El manejo de error de varias pantallas es un `alert()` del navegador; el borrado se confirma
con `confirm()`. Funciona, pero es inconsistente con el resto de la UI (que ya tiene toasts y
paneles de error) y bloquea el hilo.

**Por qué no lo arreglé**: es trabajo de UI con criterio de diseño, no limpieza mecánica.

### B-8 · `scripts/` fuera de la vara de lint

`scripts/verify-home.js` y `verify-ui.js` suman 6 `no-require-imports` y `worker.mjs` un
`no-unused-vars`. Son scripts CJS de verificación, no código de producto.

**Decisión de ZEUS**: o se ponen bajo la misma vara que `src/`, o se declaran ignorados en
`eslint.config.mjs`. Lo que no debería quedar es a medias, contando como deuda algo que nadie
piensa arreglar.

### B-9 · El troceado sigue pendiente (ya tenía spec propia)

`BaseTab.tsx` **1403** líneas (creció con esta spec: los tipos que le faltaban), 
`LicitacionesTab.tsx` 944, `configuracion/page.tsx` 715. Cuatro de los problemas de lint que
quedan viven ahí dentro y no se pueden tocar sin trocear. **Confirmo la prioridad**: es el
frente que desbloquea el resto.

---

## C · Lo que se comprobó y está sano

- **Toda ruta API exige sesión**: `superficie.test.ts` lo verifica invocando cada manejador; la
  ruta nueva de SPEC-008 quedó cubierta sola.
- **Toda ruta API tiene test** (ZEUS ya lo había verificado; confirmado).
- **`src/lib` y `src/app/api` en 0 `no-explicit-any`**: el contrato de la spec 002 sigue en pie.
- **Singleton de Prisma y de pg-boss** conforme a §3.1.
- **Ninguna ruta filtra `err.message`** al cliente: el contrato `apiError` se respeta.
- **Los catálogos sin paginar** (`estados`, `tipos`, `entidades`, `models`, `apis`) no son
  deuda: son listas acotadas por naturaleza, no crecen sin techo.

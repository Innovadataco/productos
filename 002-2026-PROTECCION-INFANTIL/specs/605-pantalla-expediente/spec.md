# SPEC-605 · Pantalla madre del EXPEDIENTE (5 bloques) + lista por urgencia

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-09 · **Origen**: diseño final aprobado (`design/expediente-final-mockup.html` §1 «Tus expedientes» y §2 «El expediente» — pantalla madre con 5 bloques). Sobre los cimientos de SPEC-604 (toda cadena del padre nace con expediente, `Reporte.hijoId`). Rama `work/pi-SPEC-605-pantalla-expediente`.

## Modelo aprobado

La pantalla del expediente del padre se REHACE con los 5 bloques del mockup, en este orden: **① cabecera** (chip del menor desde `hijoId`, EXP/id, identificador, plataforma, estado En proceso/Procesado + «Consultar estado», SEMÁFORO grande con explicación en lenguaje sencillo) · **② «¿Qué ha pasado con esta cuenta?»** (línea de tiempo unificada: propios marcados «tú» + otras familias blindadas, con nota de privacidad) · **③ «Tu evidencia»** (eventos propios con el texto tapado — `TextoSensible` intacto; SPEC-606 le cambia el step-up) · **④ «El análisis»** (clasificación dominante + confianza + quién revisó + «También consideró» + caja «¿Qué significa?» + TENDENCIA simple) · **⑤ Acciones** («+ Agregar evento», «Llevar a un profesional», canales oficiales). La lista «Mis expedientes» se ordena por URGENCIA (clasificación dominante: alta → media → baja → sin clasificar; cerrados al final).

## User Stories

### US1 — La pantalla madre con sus 5 bloques (P1)

Como padre, al abrir un expediente quiero entender de un vistazo qué está pasando con esa cuenta: quién de los míos la toca, qué tan seria es, qué ha pasado, qué aporté yo, qué concluyó la revisión y qué puedo hacer — sin jerga técnica.

- La cabecera muestra el chip del menor (avatar con iniciales + nombre + edad derivada del año de nacimiento) resuelto desde `Reporte.hijoId` (el reporte propio más reciente con ficha) o, si ninguno la trae, desde la ficha que vigila ese identificador (`IdentificadorHijo` activo, mismo criterio que `lecturaDelExpediente`).
- El semáforo grande explica en lenguaje sencillo y con presunción de inocencia: «Nivel alto — esta cuenta tiene X reportes registrados por N familias» (nunca veredictos tipo «número peligroso»). Con el expediente ESCALADO/PENDIENTE_COMITE/EN_ACLARACION agrega que el comité ya la está evaluando.
- La línea de tiempo mezcla, en orden cronológico descendente: cada evento propio (tag «tú», categoría, nota honesta — «Primer reporte de este expediente», «en proceso de clasificación», «el texto está en Tu evidencia») y los eventos de OTRAS familias agrupados por (día, categoría) como «una familia más» / «N familias más» con ciudades y la nota «el texto de otros reportes no se comparte».
- «El análisis» muestra la clasificación dominante con su % de confianza, «revisado por una persona» solo cuando la huella es manual (SPEC-359 · B2; si no, «clasificación automática del motor local»), «También consideró» con las secundarias, la caja «¿Qué significa?» (parámetro `padre.analisis.explicacion.<categoria>`, mismo que cadenas-padre) y la ficha (eventos totales/tuyos, familias que reportan, estado, plataforma, menor, apertura). Sin clasificación final, lo dice sin inventar análisis.
- Escenario de aceptación: padre con 2 eventos propios y 3 reportes de otras familias (2 el mismo día con la misma categoría) ve 4 ítems en la línea de tiempo: 2 «tú», 1 «una familia más» y 1 «2 familias más» con ambas ciudades.

### US2 — «Consultar estado» con refresco real (P1)

Como padre, quiero pulsar «Consultar estado» y ver el estado FRESCO del expediente (mis eventos siguen en clasificación o ya terminaron), sin recargar la página a mano.

- Nuevo endpoint `GET /api/padre/expedientes/[id]/estado` (subruta ligera: estados y fechas, jamás texto — la ruta vieja `GET [id]` sigue borrada por el candado de SPEC-340).
- Regla: algún evento propio en `PENDIENTE`/`PROCESANDO` → `EN_PROCESO`; todos fuera de cola → `PROCESADO`. El pill de la cabecera se actualiza con la respuesta y la página se refresca (`router.refresh()`).
- Boundary: 401 sin sesión, 403 rol ≠ PARENT, 404 expediente ajeno.

### US3 — La lista «Mis expedientes» por urgencia (P1)

Como padre con varios expedientes, quiero ver primero el que más atención necesita, con el resumen de cuánto aporté yo y cuánto la comunidad.

- Tarjetas ordenadas por urgencia derivada de la clasificación dominante (severidad de `riesgo-consulta`: ≥75 alta → rubí «Alerta prioritaria», ≥50 media → ámbar «Requiere atención», <50 baja → menta «Sin novedades», sin clasificar → gris); los CERRADO al final; desempate por última actividad. Barra de urgencia al borde izquierdo (rubí/ámbar/menta/gris).
- Cada tarjeta: chip del menor, EXP/id (código corto estable: `EXP-` + 6 últimos del id), identificador, plataforma, semáforo, clasificación dominante, «N eventos tuyos · M familias más reportaron» (o «sin reportes de otros»), última actividad, [Abrir expediente] [+ Reportar evento → `/dashboard/padre/reportar`].
- Botón global «+ Reportar una situación» → `/dashboard/padre/reportar`. Nota al pie: «Reportar sobre una cuenta con expediente suma un evento al mismo expediente; sobre una cuenta nueva abre uno» (modelo SPEC-604).

### US4 — Blindajes heredados intactos (P1 · candado)

Como plataforma, la pantalla madre NO afloja ningún blindaje: el texto de los reportes (propio o ajeno) JAMÁS viaja en el DTO (la evidencia propia se revela por `TextoSensible` con step-up, sin tocar); los ajenos se exponen solo como metadatos incluyendo anónimos y DUPLICADOS (SPEC-543 · I-330) y excluyendo SPAM/OTRO; las fechas del hecho se muestran sin minutos (A-70 · G20); canales oficiales (Línea 141 ICBF · CAI Virtual · Te Protejo) visibles en el bloque de acciones con la nota «señal comunitaria de prevención, no canal oficial de denuncia»; tono neutral sin voseo.

## Impacto en arquitectura: sí (acotado)

- **Migración: NO se agrega ninguna.** Todo se deriva de columnas existentes (`Reporte.hijoId` de SPEC-591, `IdentificadorHijo`, `ClasificacionIA`, `Expediente`).
- **Navegación/rutas: UNA subruta API nueva** — `GET /api/padre/expedientes/[id]/estado` (PARENT, cubierta por la regla de prefijo `/api/padre` del proxy; sin cambios en `src/lib/proxy.ts` ni en el menú). Las páginas `/dashboard/padre/expedientes` y `.../[id]` se reescriben en el sitio (mismas rutas). `npm run arch:check` queda en VERDE sin regenerar artefactos (SPEC-487: los artefactos append-por-ruta no se tocan en el PR).
- **Nuevo servicio DAL**: `src/lib/dal/services/expediente-detalle.ts` (`listarExpedientesPadreConUrgencia` · `detalleExpedientePadre` · `estadoFrescoExpediente`). Reusa `SEVERIDAD_CATEGORIA` de `src/lib/riesgo-consulta.ts` (ahora exportada — misma escala que la consulta pública, una sola fuente).
- **Pantalla vieja fuera de la ruta**: `ExpedienteVivo.tsx` (SPEC-340: mapa + reproducción + informes PDF) deja de renderizarse en `[id]/page.tsx`; el archivo y sus endpoints (`lectura`, `analisis`, `pdf`) quedan intactos por si la siguiente ola los reubica (deuda registrada en tasks.md).
- **Derogación parcial**: los filtros Todos/Activos/En revisión/Cerrados de la lista vieja desaparecen — el principio organizador ahora es la urgencia (diseño aprobado).

## Functional Requirements

- **FR-001**: La página `[id]` DEBE renderizar los 5 bloques en el orden del mockup (cabecera → línea de tiempo → evidencia → análisis → acciones) y la cabecera DEBE mostrar el chip del menor resuelto desde `Reporte.hijoId` (más reciente) con fallback a `IdentificadorHijo` activo; sin ficha, el expediente se muestra sin chip.
- **FR-002**: El semáforo DEBE derivarse de la clasificación dominante (propios finales + ajenos aprobados/duplicados) con la escala `SEVERIDAD_CATEGORIA` (≥75 alta, ≥50 media, resto baja, sin clasificación «Sin clasificar todavía») y la explicación DEBE usar lenguaje estadístico («N reportes registrados por M familias»), nunca veredictos.
- **FR-003**: La línea de tiempo DEBE mezclar propios (tag «tú», `reporteId` para la evidencia) y ajenos blindados (fecha · ciudades · categoría · «N familias más», agrupados por día Bogotá + categoría) en orden cronológico descendente, y NUNCA DEBE incluir texto (propio ni ajeno) ni autoría de los ajenos. SPAM/OTRO quedan fuera.
- **FR-004**: «Tu evidencia» DEBE listar los eventos propios con `TextoSensible` SIN cambios en su step-up (SPEC-606 lo reemplaza).
- **FR-005**: «El análisis» DEBE mostrar dominante + % confianza del reporte más reciente con esa categoría + «revisado por una persona» solo si `modeloUsado` empieza por `manual` + «También consideró» (secundarias) + «¿Qué significa?» (parámetro por categoría) + tendencia derivada de los reportes llegados en los últimos 7 días contra los 7 anteriores (subiendo/estable/bajando). Sin clasificación final DEBE decirlo sin plantilla falsa.
- **FR-006**: «Consultar estado» DEBE llamar a `GET /api/padre/expedientes/[id]/estado` y actualizar el estado mostrado: eventos propios en `PENDIENTE`/`PROCESANDO` → «En proceso»; si no → «Procesado». El endpoint DEBE exigir PARENT dueño (401/403/404) y responder solo estados y fechas.
- **FR-007**: La lista DEBE ordenar por urgencia (alta → media → baja → sin clasificar; cerrados al final; desempate última actividad) y cada tarjeta DEBE mostrar chip del menor, código EXP, identificador, plataforma, semáforo, dominante, «N eventos tuyos · M familias más reportaron», última actividad y las acciones [Abrir expediente] [+ Reportar evento]; el botón global «+ Reportar una situación» DEBE ir a `/dashboard/padre/reportar`. «Familias» cuenta usuarios distintos + 1 por cada anónimo.
- **FR-008**: La spec DEBE declarar `## Impacto en arquitectura:` explícito (ratchet CI, SPEC-126) — ver la sección arriba.
- **FR-009**: Candados: texto jamás en el DTO (ni propio ni ajeno); fechas del hecho sin minutos; canales oficiales visibles; tono neutral sin voseo; el flujo anónimo NO se toca; `TextoSensible` sin cambios funcionales.

## Criterios de aceptación

1. Padre con expediente mixto (2 propios + 3 ajenos, 2 de ellos mismo día/categoría) ve la línea de tiempo con 4 ítems ordenados, el grupo «2 familias más» con sus 2 ciudades, y el JSON del DTO no contiene ningún texto de reporte (candado en test).
2. «Consultar estado» con un evento PENDIENTE devuelve `EN_PROCESO` (pill «En proceso»); al clasificarse, devuelve `PROCESADO`. 404 ajeno, 403 no-PARENT, 401 sin sesión (test del endpoint).
3. Lista con 4 expedientes (alta/baja/sin clasificar/cerrado-media) los ordena alta → baja → sin clasificar → cerrado y muestra «1 evento tuyo · 3 familias más reportaron» en el de alta (test).
4. Tendencia con 2 reportes nuevos esta semana y 1 la anterior dice «subiendo — 2 reportes nuevos en los últimos 7 días (antes: 1)»; sin nuevos, «estable — Sin reportes nuevos» (tests).
5. El menor aparece como «Valentina Gómez · 7 años» cuando el reporte trae `hijoId`, y como «Laura Ruiz» cuando solo lo vigila un `IdentificadorHijo` (tests).

## Assumptions

- El código corto `EXP-XXXXXX` (6 últimos del cuid en mayúsculas) es solo de exhibición; la URL sigue usando el id completo.
- La urgencia usa la severidad por categoría de la consulta pública (misma tabla exportada), no el `scoreGravedadActual` del expediente (lo calcula otro motor con otros insumos).
- «Familias» es una aproximación honesta: un usuario = una familia; cada anónimo cuenta una más (no hay forma de deduplicarlo sin violar su anonimato).
- La tendencia se calcula sobre `creadoEn` (cuándo LLEGARON los reportes); la línea de tiempo ordena por `fechaIncidente` (cuándo PASÓ cada hecho).
- La plataforma mostrada sale del reporte que abrió la cadena (misma fuente que cadenas-padre): `Expediente.plataformaId` no tiene relación en el schema.

## Implementación (al cierre)

- DAL `src/lib/dal/services/expediente-detalle.ts`: `listarExpedientesPadreConUrgencia`, `detalleExpedientePadre`, `estadoFrescoExpediente` (+ `codigoExpediente`, `urgenciaDeCategoria`). `src/lib/riesgo-consulta.ts`: exporta `SEVERIDAD_CATEGORIA` (comentario SPEC-605).
- API `src/app/api/padre/expedientes/[id]/estado/route.ts` (GET, PARENT dueño).
- UI: `src/components/modules/padre/ExpedienteMadreClient.tsx` (5 bloques) y `src/components/modules/padre/ExpedientesListClient.tsx` (reescrita: tarjetas por urgencia); páginas `src/app/dashboard/padre/expedientes/page.tsx` y `.../[id]/page.tsx` reescritas sobre el DTO serializado.
- Tests: `src/lib/dal/services/expediente-detalle.test.ts` (10) y `src/app/api/padre/expedientes/[id]/estado/route.test.ts` (2).

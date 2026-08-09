# Feature Specification: SPEC-158 — Tablero de control del colegio

**Feature Branch**: `work/002-pi-058`

**Created**: 2026-08-03

**Status**: IMPLEMENTADO

**Input**: Instructivo 002-PI-058 (lote D-51, 146→147→158; radica ZEUS). Fuentes
VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §10 fila 6 ("Embudo de estado (recibidos
→ cerrados → en revisión → te esperan a ti), ritmo mensual, reloj de actividad 24 h
y barras por curso. Una query agregada por vista, cero N+1. **El reloj es el gráfico
clave**: revela que la mayoría de reportes ocurren de noche"), §4.0.2 ("la forma es
el dato"), §4.4 ("SVG propio para los anillos y el reloj de actividad"), §4.3, §3
(terminología), §9 (accesibilidad/rendimiento). Patrones: SPEC-134 (tenant-first),
SPEC-143 (métrica D2 = reportes distintos, series, `homeRector` en una llamada).

Verificado en fuente 2026-08-03 (exploración): NO existe la ruta
`/dashboard/colegio/tablero/`; NO hay agregación por hora del día en el repo; las
series mensuales y el top por curso ya existen (`alerta-colegio.ts`,
`colegio-resumen.ts`) y se reusan; estados de `AlertaColegio`: `nueva | vista |
gestionada` con `creadoEn`/`actualizadoEn`; ya existe `/dashboard/colegio/estadisticas`
(página vieja de estadísticas — el tablero NO la reemplaza en esta SPEC, ver
Assumptions); Recharts 3.10.1 instalado con el patrón de `TendenciaReportes`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — El embudo: qué me espera a mí (Priority: P1)

Como rector, quiero ver en cuatro cifras grandes el embudo de los reportes de mi
colegio — recibidos, cerrados, en revisión y los que **me esperan a mí** — de modo
que sepa de un vistazo si tengo trabajo pendiente.

**Why this priority**: "Te esperan a ti" es el verbo del tablero (§4.0.3): el
rector abre, ve su número y sabe qué hacer. Es la cabecera de la página.

**Independent Test**: con 5 reportes distintos del colegio (2 con alertas solo
gestionadas, 1 con alertas vista, 1 con alerta nueva, 1 con alertas nueva+gestionada),
el embudo muestra: recibidos 5 · cerrados 2 · en revisión 1 · "te esperan a ti" 2 —
cada reporte contado UNA SOLA VEZ en el bucket de su estado más pendiente.

**Acceptance Scenarios**:

1. **Given** reportes con alertas en estados mixtos, **When** se calcula el embudo,
   **Then** cada reporte cuenta una sola vez: "te esperan a ti" si tiene ≥1 alerta
   `nueva`; si no, "en revisión" si tiene ≥1 `vista`; si no, "cerrados" (todas
   `gestionada`) — y los 4 buckets suman exactamente "recibidos" (test con fixture
   mixto, sin solapes).
2. **Given** el bucket "te esperan a ti", **When** es > 0, **Then** la tarjeta lo
   destaca con el estado ámbar/rubí del sistema y enlaza a las alertas del colegio
   — cada pantalla termina en un verbo.
3. **Given** cero reportes en el periodo, **When** se renderiza, **Then** el embudo
   muestra ceros con copy positivo ("nada te espera — la vigilancia sigue activa"),
   nunca una pantalla rota.

---

### User Story 2 — El reloj de actividad 24 h (Priority: P1)

Como rector, quiero ver a qué horas del día llegan los reportes en un reloj de 24
horas, de modo que entienda que la mayoría ocurren de noche — cuando los
estudiantes están sin supervisión.

**Why this priority**: "El reloj es el gráfico clave" (§10). Es el insight que
cambia la conversación con los acudientes: el riesgo es nocturno.

**Independent Test**: con reportes sembrados a las 2h, 14h y 23h (hora Colombia),
el reloj dibuja 24 sectores con picos en esas horas y ceros en el resto — en hora
LOCAL de Colombia, no UTC (a las 21 UTC son las 16 en Bogotá).

**Acceptance Scenarios**:

1. **Given** el reloj 24h, **When** se renderiza, **Then** es SVG propio (§4.4) con
   24 sectores/barras radiales cuya longitud codifica los reportes de cada hora
   (métrica D2), dibujado al entrar con la curva única, mudo con reduced-motion, y
   con resumen textual sr-only ("la mayoría de reportes llegan entre las 21 h y las
   3 h").
2. **Given** los datos, **When** se agregan por hora, **Then** la hora es la de
   `America/Bogota` (`AT TIME ZONE` en SQL con fallback documentado si la tz no
   existe en la BD) y el eje cubre 0-23 con ceros rellenos.
3. **Given** cero reportes, **When** se renderiza, **Then** el reloj muestra el
   círculo vacío con copy honesto ("aún no hay actividad suficiente para leer el
   reloj") — nunca picos inventados.

---

### User Story 3 — Ritmo mensual y barras por curso (Priority: P2)

Como rector, quiero ver el ritmo de reportes mes a mes y qué cursos concentran la
actividad del periodo, de modo que ponga la atención donde hace falta.

**Why this priority**: Complementa la decisión ("cada pantalla termina en un
verbo"): el reloj dice CUÁNDO actuar, las barras dicen DÓNDE.

**Independent Test**: con actividad en 3 cursos y varios meses, el área mensual (12
puntos) y las barras por curso (30 días, métrica D2, con nombre del curso) coinciden
con el fixture; clic en un curso lleva a su vista (SPEC-147).

**Acceptance Scenarios**:

1. **Given** el ritmo mensual, **When** se renderiza, **Then** usa el patrón de
   `TendenciaReportes` (AreaChart monotone, token, tooltip humano, sr-only) con los
   últimos 12 meses y su total.
2. **Given** las barras por curso, **When** hay actividad en 30 días, **Then** se
   ordenan descendente con nombre del curso, métrica D2, enlace a
   `/dashboard/colegio/cursos/[id]`; sin actividad → copy positivo.
3. **Given** el tablero completo, **When** se audita rendimiento, **Then** TODOS
   sus datos salen de UNA llamada a `tableroColegio(colegioId)` (consultas
   paralelas/agregadas, cero N+1) y ningún dato cruza tenants (test A/B).

---

### Edge Cases

- **Reporte con alertas en varios cursos** (identificadores de 2 estudiantes de 2
  cursos): en barras por curso se atribuye a cada curso (como en la home); en el
  embudo cuenta UNA vez en su bucket más pendiente.
- **Timezone faltante en la BD**: si `AT TIME ZONE 'America/Bogota'` falla, el
  reloj cae a UTC-5 fijo documentado en el SQL (Colombia no tiene DST) — nunca a
  UTC del servidor.
- **Periodo sin actividad**: las 4 visualizaciones muestran estados honestos
  (ceros/copy positivo), ninguna se rompe.
- **La página vieja `/dashboard/colegio/estadisticas`**: sigue existiendo (ver
  Assumptions); el tablero es una página NUEVA con su ítem de nav.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página `/dashboard/colegio/tablero/` DEBE existir con los cuatro
  bloques (embudo, reloj 24h, ritmo mensual, barras por curso), ítem de nav
  "Tablero" en `COLEGIO_NAV_ITEMS` (href alcanzable — aserción B de arch:check),
  100% tokens y terminología §3.
- **FR-002**: Todos los datos DEBEN salir de UNA llamada a
  `ColegioResumenRepository.tableroColegio(colegioId)` (o repo propio equivalente):
  Promise.all de agregados, cero N+1, tenant en cada query (test A/B).
- **FR-003**: El embudo DEBE contar reportes DISTINTOS (D2) con un bucket por
  reporte según su estado más pendiente (nueva > vista > gestionada), sin solapes:
  recibidos = cerrados + en revisión + te esperan a ti. SQL raw con tenant y
  nombres físicos.
- **FR-004**: El reloj DEBE ser SVG propio (sin librería de chart radial), 24
  sectores por hora en `America/Bogota` (con fallback UTC-5), métrica D2, ceros
  rellenos, animación con la curva única, sr-only con el rango pico, reduced-motion
  quieto, y test.
- **FR-005**: El ritmo mensual DEBE reusar la serie mensual existente (12 puntos,
  D2) con el patrón de `TendenciaReportes`; las barras por curso DEBEN reusar el
  top por curso (30d, D2, sin límite o límite alto) con nombre y enlace al curso.
- **FR-006**: Tests nuevos: repo (embudo sin solapes con fixture mixto, reloj por
  hora Bogotá con ceros, A/B tenant, conteo de queries) + componentes (embudo por
  estado, reloj SVG con fixture, estados vacíos) + journeys/existentes verdes sin
  tocarlos.
- **FR-007**: I-29 intacto (solo conteos agregados del propio colegio); no se toca
  `src/lib/ai/**` ni la página vieja de estadísticas; cero color crudo;
  `tokens:check` ≤ piso vigente (1122).

### Key Entities

- **TableroColegio (DTO)**: `{ embudo: { recibidos, cerrados, enRevision,
  teEsperan }, ritmoMensual: Serie[12], reloj24h: number[24], barrasCurso: [{
  cursoId, nombre, reportes30d }] }`.
- **Bucket del embudo**: derivado por reporte (estado más pendiente de sus
  alertas), no por fila de alerta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Embudo sin solapes: con el fixture mixto, `cerrados + enRevision +
  teEsperan === recibidos` y cada reporte en su bucket correcto (test).
- **SC-002**: Reloj en hora Colombia: un reporte a las 02:00 UTC del 2 de agosto
  pica en la hora 21 (del 1 de agosto, Bogotá) — test que lo prueba; 24 posiciones
  con ceros.
- **SC-003**: UNA llamada al repo por carga (conteo de invocaciones en test), cero
  N+1; A/B tenant: B nunca ve actividad de A.
- **SC-004**: Nav "Tablero" alcanzable (aserción B) y cero pantallas viejas tocadas
  (`git diff --stat` sin `estadisticas/`).
- **SC-005**: `tokens:check` ≤ 1122; checks de día verdes (tsc/lint/arch:check +
  tests del área).

## Assumptions

- La página vieja `/dashboard/colegio/estadisticas` NO se reemplaza en esta SPEC:
  el tablero es nueva y convive; una eventual consolidación es decisión aparte (no
  la invento).
- El embudo se calcula sobre TODOS los reportes del colegio con alerta (sin ventana
  temporal); ritmo/barras/reloj usan sus ventanas (12 meses / 30 días / todo el
  histórico para el reloj — el patrón nocturno es estructural, no del mes).
- "Te esperan a ti" enlaza a `/dashboard/colegio/alertas` (página existente).
- El reloj usa `America/Bogota` fija (producto Colombia; sin DST) — generalización
  por país queda fuera.

## Impacto en arquitectura

Impacto en arquitectura: **añade una ruta de página** (`/dashboard/colegio/tablero/`)
y un ítem de navegación ⇒ aserciones A/B de `arch:check` deben quedar VERDES (la
puerta del proxy ya cubre `/dashboard/colegio/*` para SCHOOL_ADMIN). No modifica
schema ni stack.

## Implementación

Implementada 2026-08-03 en `work/002-pi-058` (lote D-51: `09b01ede` + `f0a9a9cc` +
`fb28e1f4`). Evidencia, decisiones de implementación y deuda en
[cierre.md](./cierre.md).

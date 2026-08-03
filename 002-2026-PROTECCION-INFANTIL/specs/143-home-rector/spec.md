# Feature Specification: SPEC-143 — Home operativo del rector

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-08-03

**Status**: PLANEADO

**Input**: Instructivo 002-PI-058 (orden 3 del brief §10; radica ZEUS, luz verde tras
CUMPLE de SPEC-145). Fuentes VINCULANTES: BRIEF-DISEÑO-UX-RECTOR v3.0 — §4 sistema de
diseño (instalado en SPEC-157: tokens, Instrument, `Anillo`/`PanelVidrio`/
`LuzAmbiental`/`Declaracion`), §5.1 mockup home, §5.2 empty state, §3 terminología.
Anclaje §10: **reemplaza `src/app/dashboard/colegio/page.tsx`** (hoy renderiza
`ConsultaPublica` + `PublicDashboard` — estadísticas PÚBLICAS de plataforma, nada del
colegio; supera la decisión C2/C3 de SPEC-129, que se documenta como superada);
`layout.tsx` (auth + vigencia + `ColegioSideNav`) se conserva; nueva
`ColegioResumenRepository.homeRector(colegioId)` en UNA llamada. Es la primera
pantalla que monta el sistema completo de la 157 — la que demuestra si sirve.

Verificado en fuente 2026-08-03 (exploración dirigida): la page actual es Server
Component que repite la auth del layout y solo muestra ficha del colegio + consulta
pública + stats públicas globales; NO existe ninguna query de cobertura
(identificadores/acudiente), ni conteos por periodo de `AlertaColegio`, ni `contar`
de profesores, ni timestamp de "última señal"; el vínculo reporte↔colegio es
`AlertaColegio` (un `Reporte` NO tiene colegio); `CanalesOficiales` existe y no se
usa en ninguna pantalla del colegio; `recharts` y `lucide-react` NO están
instalados.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Abrir y entender en 30 segundos: declaración de estado + franja + KPIs (Priority: P1)

Como rector, al abrir `/dashboard/colegio` quiero ver el estado de protección de MI
colegio en lenguaje humano — saludo con mi nombre, la declaración de estado con su
palabra en cursiva, los números grandes (estudiantes, cursos, profesores, reportes
del mes) y una franja que me dice que la vigilancia sigue viva — de modo que sepa si
hoy tengo que actuar o no.

**Why this priority**: Es el propósito entero de la cola ("el colegio es el cliente
que paga y no tiene cara en el producto"). Sin home propia, todo lo demás cuelga de
una pantalla que no existe.

**Independent Test**: con un colegio sembrado (estudiantes, cursos, profesores,
alertas de distintas edades), la página renderiza server-side con los KPIs correctos
contando SOLO activos y SOLO del colegio de la sesión (A/B: el colegio B nunca ve
datos de A); la declaración cambia de palabra/color con el estado.

**Acceptance Scenarios**:

1. **Given** un colegio sin alertas nuevas ni en los últimos 7 días, **When** abre la
   home, **Then** la declaración dice que todo está *tranquilo* (cursiva serif en
   pino), la luz ambiental es pino y la franja muestra la última señal registrada
   (D3) y los reportes de la semana con su delta vs la anterior.
2. **Given** ≥1 alerta en estado "nueva" (sin gestionar), **When** abre la home,
   **Then** el estado es el de máxima urgencia definido en D1 — la declaración, la
   luz ambiental y el punto de estado (pulso 3,4 s) cambian a rubí.
3. **Given** los KPIs, **When** se cuentan, **Then** estudiantes/cursos/profesores
   son SOLO activos del colegio y "reportes de este mes/semana" es la métrica
   decidida en D2 con su delta — nunca scores ni datos de otro colegio (I-29, §2.3).
4. **Given** la página, **When** se renderiza, **Then** TODOS sus datos propios salen
   de UNA llamada a `ColegioResumenRepository.homeRector(colegioId)` (consultas
   paralelas/agregadas, cero N+1) y la página no repite la auth del layout.

---

### User Story 2 — Los anillos de protección: vigilancia y reacción en personas (Priority: P1)

Como rector, quiero ver dos anillos concéntricos — estudiantes con identificadores
registrados (vigilancia) y estudiantes con acudiente a quien llamar (reacción) — con
el hueco dicho en personas, de modo que entienda a cuántos no puedo ver y a cuántos
no puedo llamar.

**Why this priority**: Es la forma firma del sistema (§4.3): "la forma es el dato" —
el arco incompleto SON los estudiantes sin cobertura. Es el primer uso real del
primitivo `Anillo` de la 157.

**Independent Test**: con 10 estudiantes (7 con identificador activo, 5 con
acudiente), los anillos dibujan 70% y 50%, el centro muestra "10 estudiantes" y la
leyenda dice "3 estudiantes sin redes registradas" / "5 sin acudiente" — cero
porcentajes huérfanos.

**Acceptance Scenarios**:

1. **Given** estudiantes activos del colegio, **When** se calcula la cobertura,
   **Then** vigilancia = % con ≥1 `IdentificadorEstudiante` activo y reacción = %
   con ≥1 `AcudienteEstudiante` (acudiente SOLO vía estudiante acotado por colegio —
   D1 de SPEC-144), con los huecos (`sinRedes`, `sinContacto`) en personas.
2. **Given** un colegio con 0 estudiantes, **When** se renderiza, **Then** los
   anillos muestran el estado de "sin datos aún" (cero división por cero) y
   convidan a crear el primer curso (enlaza con US4).
3. **Given** los anillos, **When** entran en pantalla, **Then** se dibujan con la
   curva única del sistema y quedan mudos con `prefers-reduced-motion`.

---

### User Story 3 — Tendencia y cursos que merecen mirada (Priority: P2)

Como rector, quiero ver la tendencia de reportes (semanal/mensual/anual) y los
cursos que concentran actividad reciente con su profesor titular, de modo que sepa
dónde poner atención esta semana.

**Why this priority**: Convierte datos en prioridad ("cada pantalla termina en un
verbo" — aquí el verbo es "mira este curso"). Depende de US1 (mismo repo).

**Independent Test**: con alertas distribuidas en 3 cursos y varios meses, la gráfica
serie temporal dibuja los puntos correctos por periodo y el top 3 ordena por
actividad de los últimos 30 días mostrando nombre del curso y del titular (o "sin
titular asignado").

**Acceptance Scenarios**:

1. **Given** el toggle semanal/mensual/anual, **When** cambia, **Then** la serie se
   repinta client-side con los datos ya cargados (sin fetch extra): semanal = últimas
   12 semanas, mensual = últimos 12 meses, anual = últimos 3 años, con tooltip
   humano ("3 reportes · sep 2026") y total del periodo.
2. **Given** los "cursos que merecen mirada", **When** hay actividad, **Then** se
   muestran hasta 3 cursos ordenados por alertas de los últimos 30 días con
   profesor titular y enlace al curso; si no hay actividad, el bloque lo dice en
   positivo ("ningún curso con reportes recientes").
3. **Given** la gráfica, **When** se audita accesibilidad, **Then** tiene
   descripción textual (aria-label/resumen sr-only) y ningún color fuera de tokens.

---

### User Story 4 — Empty state, acciones rápidas y protocolo oficial (Priority: P2)

Como rector de un colegio nuevo, quiero que la home me guíe al primer paso (crear
curso o subir mi lista) con una celebración de "tu colegio está listo", y ver siempre
las acciones rápidas y los canales oficiales, de modo que nunca me quede sin saber
qué hacer.

**Why this priority**: "Cada pantalla termina en un verbo" y "la interfaz nunca
muestra vacío" (§4.0). El empty state es el primer día del colegio; las acciones y
el protocolo son el cierre permanente.

**Independent Test**: colegio sin cursos → empty state §5.2 con dos CTAs a las rutas
existentes (crear curso, subir lista); colegio con datos → fila de acciones rápidas
y bloque de canales oficiales al final.

**Acceptance Scenarios**:

1. **Given** un colegio con 0 cursos, **When** abre la home, **Then** ve el empty
   state del mockup §5.2 (hero, "Tu colegio está listo para empezar", CTA gigante
   "Crear primer curso" y enlace "¿Ya tienes tu lista en Excel?") — NO el dashboard
   con ceros.
2. **Given** un colegio con cursos, **When** baja al final, **Then** hay acciones
   rápidas (Crear curso y estudiantes, Subir Excel, Profesores, Ver estudiantes) a
   rutas existentes y el bloque de canales oficiales (`CanalesOficiales`: Línea 141
   ICBF, CAI Virtual, Te Protejo).
3. **Given** cualquier estado de la home, **When** se navega por teclado, **Then**
   todos los CTAs son alcanzables con foco visible (WCAG AA) y los textos usan la
   terminología §3 (estudiantes, profesores, subir lista — nunca "alumnos",
   "carga masiva", "gestión de").

---

### Edge Cases

- **Colegio sin profesores aún** (el modelo nació en 145): KPI "profesores" = 0 sin
  romper; el bloque de cursos muestra "sin titular asignado".
- **Colegio sin alertas jamás**: franja en positivo ("sin señales aún — la vigilancia
  está activa") y tendencia con serie de ceros dibujada (no eje vacío roto).
- **Alertas > 0 pero 0 esta semana**: el delta no muestra "-0" ni porcentajes
  infinitos; regla de copy definida en implementación (flecha solo con
  comparación válida).
- **Página lenta o sin datos por error**: skeleton screens (§4.8), nunca spinner
  infinito; error con mensaje humano.
- **Datos multi-tenant**: la página es server component con `colegioId` de sesión;
  no existe parámetro que permita pedir otro colegio (por construcción).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página `/dashboard/colegio` DEBE reemplazarse por la home del brief
  §5.1 (saludo + fecha, declaración de estado, franja de vigilancia, KPIs, anillos,
  tendencia, cursos que merecen mirada, acciones, canales oficiales), montando
  tokens, tipografía y los 4 primitivos de SPEC-157. `layout.tsx` y la nav NO se
  tocan; la decisión C2/C3 de SPEC-129 queda SUPERADA (documentado al cierre).
- **FR-002**: Todos los datos propios DEBEN salir de UNA llamada a
  `ColegioResumenRepository.homeRector(colegioId)` (nuevo repo DAL, tenant-first):
  consultas paralelas/agregadas, cero N+1. La página es Server Component y NO repite
  la auth del layout.
- **FR-003**: Los KPIs DEBEN contar solo ACTIVOS del colegio: estudiantes, cursos,
  profesores (métodos nuevos o variantes con filtro de estado — NO se cambia la
  semántica de los `contarPorColegio` existentes) y reportes del periodo (D2) con
  delta vs periodo anterior.
- **FR-004**: El estado del semáforo DEBE seguir la regla de D1 (propuesta: rubí =
  ≥1 alerta "nueva" sin gestionar; ámbar = 0 nuevas pero ≥1 alerta en los últimos 7
  días; pino = resto) y pintar `Declaracion` (palabra en cursiva serif + color),
  `LuzAmbiental` y el punto de estado con pulso 3,4 s.
- **FR-005**: Los anillos DEBEN usar el primitivo `Anillo` con vigilancia (%
  estudiantes activos con ≥1 identificador activo) y reacción (% con ≥1 acudiente,
  accedido solo vía estudiante acotado por colegio), centro con escudo+número y
  leyenda con los huecos en personas. Cero divisiones por cero.
- **FR-006**: La tendencia DEBE ser Recharts `AreaChart` (`type="monotone"`,
  gradiente sutil, un color por serie desde tokens, tooltip humano) con toggle
  semanal (12 semanas) / mensual (12 meses) / anual (3 años) client-side sin refetch,
  más resumen textual accesible.
- **FR-007**: "Cursos que merecen mirada" DEBE mostrar hasta 3 cursos por alertas de
  los últimos 30 días con nombre de curso y profesor titular, enlace al curso y copy
  positivo cuando no hay actividad.
- **FR-008**: La franja de vigilancia DEBE mostrar la última señal (D3) y los
  reportes de la semana con delta vs la anterior, en copy positivo (§4.0.1: la calma
  se muestra como trabajo, nunca como vacío).
- **FR-009**: El empty state (0 cursos) DEBE seguir el mockup §5.2 con CTAs a rutas
  existentes; las acciones rápidas y `CanalesOficiales` cierran la home con datos.
- **FR-010**: Dependencias nuevas: `recharts` y `lucide-react` (brief §4.4/§4.1) —
  versiones fijadas en package.json; `06-stack.md` regenerado y `arch:check` VERDE.
- **FR-011**: Todo texto de la página DEBE cumplir la terminología §3 (estudiantes,
  profesores, subir lista, avisos; verbos activos; prohibido "alumnos", "gestión de",
  jerga interna) y tap targets ≥ 48px.
- **FR-012**: Movimiento solo con la curva única; entradas escalonadas; anillos y
  cifras se dibujan/cuentan una vez y se callan; `prefers-reduced-motion` apaga
  TODO; cero color crudo de Tailwind en el código nuevo (ratchet `tokens:check` no
  puede subir — las pantallas que se RETIRAN pueden hacerlo bajar).
- **FR-013**: I-29 intacto: ningún score, categoría técnica ni texto de reporte en la
  home — solo conteos agregados del propio colegio. No se toca `src/lib/ai/**`.
- **FR-014**: Tests: homeRector repo (A/B tenant, cobertura, periodos, top cursos,
  sin N+1) + regla del semáforo + componentes nuevos de la home (render por estado,
  empty state, accesibilidad) + la página compila como server component.

### Key Entities

- **HomeRector (DTO)**: salida única de `ColegioResumenRepository.homeRector` —
  colegio (nombre, vigencia), KPIs, cobertura (vigilancia/reacción + huecos),
  alertas por periodo + series temporales, top cursos con titular, última señal,
  contadores para el semáforo.
- **AlertaColegio** (existente): el vínculo reporte↔colegio; fuente de "reportes
  recibidos" (métrica D2), del semáforo y de la tendencia.

## Decisiones pendientes de ZEUS (compuerta §4)

- **D1 — Regla del semáforo.** Propuesta: **rubí** = ≥1 alerta en estado "nueva" (sin
  gestionar) · **ámbar** = 0 nuevas pero ≥1 alerta en los últimos 7 días · **pino** =
  el resto. (La regla debe ser simple de explicar al rector; alternativa: ámbar solo
  si alertas nuevas 0 pero gestionadas pendientes de seguimiento.)
- **D2 — Métrica "reportes recibidos".** (a) **Reportes DISTINTOS** con alerta en el
  periodo (`COUNT(DISTINCT reporteId)` — recomendada: es como piensa el rector, "2
  reportes"); (b) filas `AlertaColegio` (matches; infla si un reporte toca varios
  identificadores). La tendencia usa la MISMA métrica.
- **D3 — "Última revisión/señal" de la franja.** (a) `max(AlertaColegio.creadoEn)`
  del colegio (**recomendada**; si nunca hubo, copy "sin señales aún — la vigilancia
  está activa"); (b) timestamp de actividad del worker — no existe por colegio y
  fabricarlo sería mentir.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El rector ve SOLO datos de su colegio: test A/B con dos colegios —
  ningún KPI, anillo, curso o señal cruza tenants (query con `colegioId` en cada
  conteo).
- **SC-002**: La home se sirve con UNA llamada a `homeRector` (assert en test: los
  métodos del repo se invocan una vez por carga; queries paralelas, cero N+1 medido
  por conteo de queries en el test del repo).
- **SC-003**: Los anillos muestran los porcentajes y huecos exactos del fixture (70%/
  50%, "3 sin redes", "5 sin acudiente") y 0 estudiantes no rompe (sin NaN).
- **SC-004**: El toggle de tendencia repinta sin fetch y las series coinciden con el
  fixture (12 semanas / 12 meses / 3 años).
- **SC-005**: `tokens:check` ≤ 1166 tras el PR (el código nuevo es 100% tokens; si la
  página retirada tenía crudos, el número baja); Lighthouse mobile ≥ 90 en
  Performance y Accessibility en `/dashboard/colegio` (scriptable).
- **SC-006**: Terminología: grep de la página nueva = 0 ocurrencias de palabras
  prohibidas del brief §3 ("alumno", "carga masiva", "gestión de", jerga interna).
- **SC-007**: Gate completo local verde (tsc && lint && tokens:check &&
  test:coverage && build && arch:check) y CI del HEAD post-merge = success.

## Assumptions

- `ConsultaPublica` y `PublicDashboard` siguen existiendo en la landing pública
  (`/`) — solo salen de la home del colegio.
- `CanalesOficiales` se reusa tal cual (sus colores crudos internos ya están en el
  piso del ratchet; su tokenización llega por desgaste).
- El nombre para el saludo es `Usuario.nombre` de la sesión; la fecha se formatea en
  español ("lunes 3 de agosto de 2026") con helper local (sin nueva dependencia).
- "Última señal" se muestra como tiempo relativo humano ("hace 12 minutos") con
  helper local; sin librería de fechas.
- Las series se calculan en el repo (groupBy por semana/mes/año sobre `creadoEn`)
  y se envían las tres al cliente (payload pequeño: ~27 puntos).
- Las acciones rápidas apuntan a rutas EXISTENTES (`cursos/nuevo`, `cursos/carga`,
  cursos, alertas); la ruta de profesores no existe aún (SPEC-148) — esa acción
  apunta a cursos hasta que exista, o se omite (decisión de implementación
  documentada).

## Impacto en arquitectura

Impacto en arquitectura: **cambia el stack** (dependencias nuevas `recharts` +
`lucide-react` ⇒ regenerar `docs/architecture/06-stack.md` y pasar `arch:check`) y
reemplaza la página `/dashboard/colegio` (misma ruta; sin tocar proxy ni navegación).
Nuevo repo DAL `ColegioResumenRepository` (tenant-first, sin cambio de schema). No
modifica el modelo de datos.

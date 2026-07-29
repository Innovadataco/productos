# Feature Specification: SPEC-001 — Centro de Control de Consumo de Tokens

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: IMPLEMENTADO

**Input**: Orden directa del CEO (2026-07-29): *"aplicación web de gestión de tokens, que me
permita conocer consumo, alertas, qué hacer si está lleno el chat. Monitorear, no actuar.
Interfaz moderna tipo NASA, filtros, comparar sesiones, recomendaciones y alertas de consumo
que indiquen qué debo hacer."* Antecedente: el 29-jul una sola sesión de Claude Code quemó
131M de tokens (52% del día) sin que nadie lo viera venir; el CLI `consumo-tokens` demostró
el valor del dato pero exige terminal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Conocer el consumo de un vistazo (Priority: P1)

Como CEO, quiero abrir una URL local y ver en segundos cuántos tokens se han consumido hoy,
qué chats fueron, cuáles siguen activos y cuánto pesa cada uno, para decidir dónde enfocar
el presupuesto semanal de tokens.

**Why this priority**: es la razón de ser de la herramienta; sin el panorama no hay decisión.

**Independent Test**: con transcripciones reales en `~/.claude/projects`, abrir
`http://127.0.0.1:8899` muestra KPIs del día (tokens totales, % caché, sesiones activas,
peso de referencia) y la tabla de sesiones con nombre, estado y última actividad, sin
requerir red externa.

**Acceptance Scenarios**:
1. **Given** transcripciones con actividad hoy, **When** cargo el panel, **Then** veo los
   KPIs del día y una fila por sesión con nombre legible (título de la app o primer mensaje).
2. **Given** una sesión con actividad hace <15 min, **Then** su estado es ● ACTIVA; si no,
   ○ INACTIVA con su última hora/fecha.
3. **Given** que no hay actividad en el rango, **Then** el panel lo dice en claro (sin tabla vacía muda).

### User Story 2 — Alertas con acción: qué hacer, no solo qué pasa (Priority: P1)

Como CEO, quiero que el panel me alerte cuando un chat está inflado o cerca del límite de
contexto y me diga **exactamente qué hacer** (`/compact`, cerrar y abrir sesión nueva,
dejar de usar un chat viejo), para no enterarme cuando ya quemó el 50% del día.

**Why this priority**: el incidente de los 131M ocurrió por falta de alerta temprana.

**Acceptance Scenarios**:
1. **Given** una sesión cuyo último turno cargó >75% del límite de contexto (200k),
   **Then** aparece alerta WARNING con la acción "usa /compact en ese chat".
2. **Given** >90% del límite, **Then** alerta CRITICAL con "cierra ese chat y abre uno nuevo;
   el contexto vive en los archivos del repo".
3. **Given** una sesión con contexto medio >150k tok/turno y >5 turnos, **Then** alerta
   "sesión inflada" con el dato y la acción.
4. Toda alerta muestra: severidad, chat afectado, métrica que la disparó y acción concreta.

### User Story 3 — Filtrar y comparar sesiones (Priority: P2)

Como CEO, quiero filtrar por rango (hoy / 7 días / 30 días) y estado (todas / solo activas),
y seleccionar dos o más sesiones para compararlas lado a lado, para entender qué patrón de
uso consume más (sesión eterna vs sesiones cortas).

**Acceptance Scenarios**:
1. **Given** el filtro "7 días", **Then** KPIs, tendencia y tabla se recalculan a ese rango.
2. **Given** dos sesiones marcadas para comparar, **Then** veo sus métricas enfrentadas
   (turnos, contexto medio, caché leído, peso, tokens por turno) con barras comparativas.
3. El filtro no repinta los colores de las sesiones ya visibles (el color sigue a la entidad).

### User Story 4 — Tendencia y techo semanal (Priority: P2)

Como CEO en plan Max con límite semanal, quiero ver la curva de consumo diario de la semana
y cuánto llevo acumulado, para dosificar los tokens antes del reset.

**Acceptance Scenarios**:
1. **Given** el rango 7/30 días, **Then** veo un gráfico de barras por día (tokens totales).
2. El día actual se distingue de los anteriores.

## Edge Cases
- Transcripción con líneas corruptas → se saltan silenciosamente (constitución §1.5).
- Sesión sin título en la app (hub Remote Control, subagentes) → nombre = primer mensaje
  del usuario, entre comillas; subagentes se etiquetan como tal.
- `~/Library/.../claude-code-sessions` inexistente → el panel funciona sin nombres de la app.
- Dos sesiones con el mismo primer mensaje ("hola") → se distinguen por id corto visible.
- Puerto 8899 ocupado → el servidor lo reporta en claro y sale con código ≠0.

## Requirements *(mandatory)*

### Functional
- **FR-001**: Servidor HTTP local (stdlib) en `127.0.0.1:8899` que sirve el panel y una API
  JSON (`/api/resumen?dias=N`).
- **FR-002**: Agregación por sesión desde `~/.claude/projects/**/*.jsonl`: tokens de entrada,
  salida, caché escrita/leída, turnos, primera/última actividad, contexto del último turno.
- **FR-003**: Resolución de nombre de chat: `title` de
  `~/Library/Application Support/Claude/claude-code-sessions/**/local_*.json` cruzado por
  `cliSessionId`; fallback al primer mensaje del usuario.
- **FR-004**: Motor de alertas con umbrales centralizados: contexto último turno ≥75% (WARN)
  y ≥90% (CRIT) del límite 200k; contexto medio >150k con >5 turnos (inflada); ≥3 sesiones
  activas simultáneas (aviso de RAM/foco).
- **FR-005**: Cada alerta incluye la acción recomendada en texto imperativo.
- **FR-006**: Filtros de rango (1/7/30 días) y estado; comparador de 2+ sesiones.
- **FR-007**: Tendencia diaria en barras SVG; KPIs del rango; auto-refresh cada 60 s.
- **FR-008**: Todo peso en USD etiquetado "referencia tarifa API — no es factura".

### Non-functional
- **NF-001**: Cero dependencias externas; cero peticiones de red salientes (constitución §1.3/§1.4).
- **NF-002**: Carga completa del panel con 30 días de datos < 3 s en la MacStudio.
- **NF-003**: UI "mission control": superficie oscura validada, sans del sistema,
  `tabular-nums` en columnas numéricas, paleta dataviz IDC modo oscuro (validada por script).
- **NF-004**: Accesibilidad: estado nunca por color solo (icono + texto); tabla como vista
  canónica de los datos.

## Success Criteria
- **SC-001**: El CEO identifica la sesión más costosa del día en <10 s desde que abre la URL.
- **SC-002**: Una sesión que supere 75% de contexto aparece alertada en el siguiente refresh (≤60 s).
- **SC-003**: `python3 -m unittest` de los cálculos pasa en verde sin red.
- **SC-004**: `curl` al panel y a la API responde 200 sin tocar la red externa.

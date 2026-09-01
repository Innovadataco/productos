# CONSTITUTION.md · Producto 006 · BI v2 · Inteligencia de Negocio

> **Este documento es LEY.** Toda decisión técnica, de diseño o de operación se somete a esta constitución. Si una tarea la contradice, se consulta ANTES de proceder.
> **Origen:** adaptada de la constitución de BI v1 (Producto 005) + decisiones del dueño del producto (Jelkin) fijadas el 2026-09-01. BI v1 queda intacto solo como referencia/cantera; no se repara pieza por pieza.
> **Autor:** CEO IDC · **Aprobado por:** Jelkin Zair Carrillo Franco · **F3C:** 2026-09-01

---

## §0 · Identidad del proyecto

- **Nombre canónico:** `Producto 006 · BI v2` (o simplemente `BI v2`)
- **Nombre carpeta:** `006-2026-BI-INTELIGENCIA-NEGOCIO`
- **Dominio:** `https://bi.innovadataco.com/`
- **Propósito:** plataforma de inteligencia de negocio para IDC sobre la operación de PI. Análisis **descriptivo**: qué pasó, qué está pasando, histórico — reportes por fechas, tendencias, comportamientos, proyecciones y estadísticas sobre la operación.
- **Alcance:** interno · Jelkin + Fábrica · dashboards operativos nativos + chat NL con LLM local. El modelo genera **SQL de solo lectura** contra la réplica.
- **Regla del nombre:** manda el NOMBRE nunca el número. Se dice `BI v2 · SPEC-XXX` · `BI v2 · A-XX` · `BI v2 · I-XX` · `BI v2 · D-XX`
- **Numeración documental (correlativa unificada por tipo):** `SPEC-001`, `SPEC-002`... · `A-01`, `A-02`... · `I-01`, `I-02`... · `D-01`, `D-02`... · `R-001`, `R-002`... · `ACTA-ARQ-01`, `ACTA-ARQ-02`...

### Decisiones fijadas por el dueño (NO se cuestionan)

| Decisión | Valor |
|---|---|
| Stack app | Next.js 16 + TypeScript + Tailwind + Prisma |
| Base de datos | PostgreSQL **réplica read-only** de PI |
| Auth | **Login propio, cerrado por defecto** (sin sesión válida no se ve nada). BI NO comparte login/JWT/cookie/secreto con PI. Credenciales hasheadas; nunca `rol` por body del cliente. (CEO 31-08-2026) |
| Rama | **Única:** `work/bi-SPEC-006-bi-v2` — de ella salen TODOS los PRs; no se borra tras merge, se rebasa sobre `main` (CEO 31-08-2026) |
| CI | Workflow propio del 006, archivo nuevo; **prohibido editar los workflows existentes de PI** (CEO 31-08-2026) |
| Réplica | Rol `bi_replica` + publicación `bi_replica` del Postgres de PI (lista explícita de tablas, SIN PII: prohibido `Usuario`/`Password`/`Session` — Ley 1581). `DATABASE_URL` apunta a la réplica con usuario propio. Si la réplica se retira de forma permanente, hay que ejecutar `pg_drop_replication_slot` (slot huérfano llena el disco y tumba PI) |
| Motor NL→SQL | **1 solo modelo** Ollama `qwen2.5:14b` · temperature 0 · structured outputs |
| Ollama | Mac Studio vía Tailscale (`100.91.87.86:11435`) |
| Dashboards | Nativos en Next.js (Tremor / Recharts / ECharts) |
| Alertas | Bot Telegram simple (solo cuando el core funcione) |
| Deploy | Docker Compose en VPS Hostinger |

### Eliminado para siempre (prohibido reintroducir)

- Apache Superset (dashboards y metadata DB)
- Vanna.ai (servicio Python pesado)
- Jurado de 3 modelos
- Login propio con clave en claro
- Paso de `rol` por body del cliente

### Reutilizado de BI v1 (cantera)

- Catálogo BI (`BICatalogoTabla` / `BICatalogoColumna` / `BICatalogoMetrica` / `BICatalogoEjemplo`) + seed
- Vistas materializadas `mv_fact_*`
- Scripts de réplica pg_logical
- Conceptos `BIConsultaLog` y `BICacheSemantico`

### Aislamiento de PI (razón de ser de la réplica)

BI corre **aparte de PI a propósito**: las consultas pesadas de BI no deben afectar la operación de PI. Por eso la base de datos de BI es una réplica **read-only**; jamás se conecta BI a la base transaccional de PI.

---

## §1 · Roles y candado de escritura (NO NEGOCIABLE)

Las sesiones que trabajan en BI v2 **no comparten contexto ni memoria**. Cada una tiene un rol específico y candados de escritura duros.

| Rol | Escribe | **NUNCA escribe** |
|---|---|---|
| **Jelkin Zair Carrillo Franco** | Decisiones de negocio · plata · legal · prioridad · valida en pruebas · ejecuta secretos y deploy a producción | — |
| **CEO** | BRIEFS · directrices a Fábrica y Calidad · `ESTADO.md` · actas de mesa estratégica | INSTRUCTIVOS · prompts para Desarrollo · specs · código |
| **Fábrica** | INSTRUCTIVOS · prompts para Desarrollo · reportes al CEO · auditoría spec+plan | BRIEFS · specs · código de producto |
| **Desarrollo** | SPECS con Spec Kit · código de producto · señales cortas | Briefs · instructivos · deploy |
| **Calidad** | RECORRIDOS de prueba (solo `tests/e2e/**` por PR) · I-XX · plan de pruebas · reportes al CEO | Código de producto · briefs · instructivos · deploy · escrituras en BD prod · leer o escribir contraseñas |

**Cadena de decisión (única):** Jelkin decide → CEO escribe brief → Fábrica traduce a instructivo + prompt → Desarrollo escribe spec e implementa → Fábrica audita → Jelkin despliega → Calidad valida en vivo.

**Comunicación entre sesiones:** las sesiones no se hablan entre sí. Jelkin es cartero · CEO coordinador. Ningún rol escribe directo a otro.

---

## §2 · Cinco Reglas de Oro (DoD mínima · ninguna se salta)

Heredadas de la metodología PI · aplican tal cual:

1. **Spec Kit en todo** · una feature = una SPEC. Sin excepciones.
2. **Subir a GitHub** · commit + push tras cada fase. Sin excepciones.
3. **Siempre pruebas** · unitarias + integración + E2E · payload real del componente.
4. **Siempre desplegable · que compile NO basta** · verificación en vivo con el rol que corresponda.
5. **Siempre documentar** · `cierre.md` por SPEC · `tasks.md` con casillas marcadas · `Status` actualizado.

---

## §3 · Los Candados obligatorios (destilados de PI · anti-alucinación LLM + disciplina)

### CATEGORÍA A · Anti-alucinación LLM (motor NL→SQL con 1 solo modelo)

#### Candado 1 · Enum cerrado en JSON Schema · sin strings libres
Cada consulta LLM devuelve `{tabla: enum[TABLAS_PERMITIDAS], columnas: [enum], operadores: [enum], filtros_col: enum[]}` con `additionalProperties: false`. Imposible inventar tabla o columna.

#### Candado 2 · Structured outputs · temp 0 · nunca parseo manual
Ollama con `format: schema` nativo · `qwen2.5:14b` · temperature 0. Si no parsea, se tira · no se rescata a la fuerza.

#### Candado 3 · Índices numéricos vs strings verbatim
Presento catálogo enumerado, LLM devuelve `{tabla_idx: 3, cols_idx: [1,4]}`. Servidor traduce a nombres reales. Elimina paráfrasis y typos.

#### Candado 4 · Descomposición en checks atómicos factuales
En vez de "¿qué me pides?" → checks decisivos: *¿qué métrica? ¿qué dimensión temporal? ¿qué filtros? ¿qué agrupación?*. Deny-by-default: si falta uno, no se genera SQL · se pide clarificación.

#### Candado 5 · Validador post-LLM estricto (sustituye al jurado multi-modelo)
Con un solo modelo, la disciplina anti-alucinación recae en: structured outputs (candado 2) + validador determinista post-generación (candado 6) + revisión humana. Si el validador NO aprueba el SQL → no se ejecuta · se registra y se escala. Un solo modelo puede fallar: el validador es la línea de defensa, no una formalidad.

#### Candado 6 · Reglas determinísticas ANTES y DESPUÉS del LLM
- Pre: regex detecta intención destructiva (`DROP`, `DELETE`, `UPDATE`, "borra", "elimina") · bloquea antes de llamar al LLM
- Post: valida que el SQL sea **solo lectura** (`SELECT`) · no toque columnas prohibidas · tenga `LIMIT` · no cross-join sin claves
- Guardas NUNCA reclasifican · solo escalan a revisión humana

#### Candado 7 · Cache semántico de veredictos HUMANOS (no de LLM)
Tabla `BICacheSemantico` (`nl_query → sql_aprobado`) alimentada por operadores. Embed de nueva pregunta busca hits ≥ umbral y devuelve SQL humano. Salida previa del LLM NO va al cache.

### CATEGORÍA B · Datos como fuente única · nunca inventar

#### Candado 8 · Catálogo como DATO editable en BD (no en prompt)
Catálogo BI (`BICatalogoTabla/Columna/Metrica/Ejemplo`) con tablas · columnas · sinónimos · glosario de métricas · ejemplos NL→SQL. El JSON Schema del LLM se construye dinámicamente contra el catálogo vigente. Cambio de esquema = UPDATE · no despliegue.

#### Candado 9 · Si no hay dato · el chat NO INVENTA
Regla dura: cuando no hay resultados, plantilla determinista: *"No hay datos operativos para esa consulta en tu ámbito. Puede ser que aún no se registren eventos de esa categoría · o el criterio sea muy específico."* Nunca completa con supuestos.

#### Candado 10 · Plantillas deterministas para toda salida narrativa al usuario
LLM genera SQL + elige plantilla. La cifra numérica viene del ResultSet · NUNCA texto libre del modelo. *"Hubo {N} reportes en {periodo}, la categoría más frecuente fue {X}"* con slots vinculados.

### CATEGORÍA C · Privacidad · auditoría (Ley 1581)

#### Candado 11 · Guard de tenancy · rechazo automático de SQL sin filtro de ámbito
3 capas (middleware app · prompt engineering · validación SQL post-generación). Ningún usuario puede ver datos fuera de su ámbito. Rechazo automático · nunca ejecuta. La consulta agregada interna nunca expone datos personales de PI.

#### Candado 12 · Traza completa por consulta (expediente)
Cada consulta guarda en `BIConsultaLog`: prompt · esquema visto · SQL propuesto · plan ejecución · filas devueltas · plantilla usada · latencia por paso · usuario · IP · timestamp. Única forma de mejorar el motor.

#### Candado 13 · Serialización + grep PII/secrets antes de emitir al usuario
Toda respuesta al usuario pasa por sanitizer que busca patrones (`\d{10}` · emails · direcciones · nombres internos del schema). Ratchet grep-based CI. Cero PII cruda escapa.

### CATEGORÍA D · Metodología y disciplina

#### Candado 14 · Verde en CI ≠ funciona · verificación en vivo obligatoria
Antes de decir CUMPLE: entrar a la app · rol correspondiente · recorrer · reportar qué viste. Aplica a cada tablero · cada consulta · cada refresh.

#### Candado 15 · Verificar en fuente · nunca suponer (con doble vía si es grave)
`git`, `gh`, BD real · nunca solo grep literal. Si `grep` da negativo · confirmar por segundo camino (AST · ejecución · BD).

---

## §4 · Cero-negociables adicionales (candados heredados de PI)

- **Migraciones aditivas · jamás destructivas.** Nunca `prisma migrate reset` ni nada que borre datos. Rebase que borre migración o revierte `schema.prisma` = HALLAZGO · PARA.
- **Healthcheck obligatorio** para todo servicio del compose · deploy no autorizado sin él. El healthcheck de BI v2 DEBE detectar MVs rotas y réplica desactualizada.
- **Cero secretos en chat/commits/docs** (regla dura I-22 de PI). Valores solo en `.env` fuera de git y en el gestor de contraseñas del CEO. En documentos y chat siempre puntero (`ver INVENTARIO-DE-SECRETOS.md`). Si una clave se expone, se rota de inmediato y se reporta.
- **`Date` nativo prohibido** para aritmética temporal. `date-fns-tz` obligatorio · `TZ=America/Bogota` en contenedores · `@db.Timestamptz(6)` explícito. Origen: D-69 de PI.
- **Seed idempotente `upsert` con `update:{}`** (no pisar valores custom). Test que corre seed 2 veces y aserta cero cambios en la 2ª pasada.
- **Ratchet de índices post-migración en CI.** Script verifica `pg_indexes` real vs lista canónica (MVs `mv_fact_*` e índices del catálogo/cache).
- **Deploy explícito por script versionado** · nunca auto-deploy desde push. Lo ejecuta Jelkin. Instrucciones de deploy versionadas en el script · nunca en chat ni memoria.
- **Push único al final del SPEC.** Gate LOCAL completo por fase antes de PUSH.
- **Máximo 2 iteraciones de CI por síntoma.** Al 3er rojo del mismo síntoma → PARA + avisa a CEO. Origen: D-55 PI.
- **`rm -rf .next` antes de creer un build.** Cachés viejas causan verdes falsos. Origen: AGENTS.md PI.
- **Un Desarrollo · un worktree.** Worktree propio por SPEC antes de arrancar en paralelo. Origen: D-82 PI.
- **Prohibido a la IA correr `DROP`/`TRUNCATE`/`migrate reset`** sin autorización humana firmada.
- **BI v1 (`005-2026-BI-INTELIGENCIA-NEGOCIO`) es solo lectura.** Se usa como cantera de catálogo, MVs, réplica y conceptos · jamás se edita ni se despliega.

---

## §5 · Compuerta §4 clásica por defecto

Desarrollo para tras `spec+plan` · CEO o Fábrica aprueba antes de implementar. Se pueden modular por frente (agilidad) pero se documenta y se busca la D-XX más reciente aplicable · nunca se asume cuál rige.

Vocabulario de señales estandarizado:

```
RADICADA · Fábrica radicó INSTRUCTIVO a Desarrollo
REVISADA · Desarrollo leyó · arranca
REALIZADO · Desarrollo terminó spec+plan · espera revisión
spec+plan LISTO · misma que REALIZADO en compuerta §4
REVISO · CEO/Fábrica aprueba el spec+plan · Desarrollo procede
CUMPLE · Fábrica auditó tras deploy · SPEC cerrado
NO CUMPLE · defecto encontrado · vuelve a Desarrollo
PARA · bloqueo · avisa a CEO
```

Cada señal es UNA línea con un verbo. Cero narrativa · cero tablas resumen.

---

## §6 · Ramas y deploy

- **Ramas de trabajo:** una por SPEC, `work/006-SPEC-<NNN>-<slug>` sobre `main` · worktree propio en `.worktrees/006-SPEC-<NNN>-<slug>` · **prohibido commitear directo a `main`**.
- **Rama tronco:** `main` (sincronizada · no despliega automáticamente).
- **Deploy:** Docker Compose en VPS Hostinger, solo por script versionado ejecutado por Jelkin (bloqueado para IA). No desplegar a producción sin decisión del responsable.

---

## §7 · Estructura del repo de código

```
productos/006-2026-BI-INTELIGENCIA-NEGOCIO/
├── .specify/
│   ├── memory/
│   │   └── constitution.md   ← este archivo
│   └── specs/                 ← todas las SPEC-XXX de Desarrollo
├── src/
│   ├── app/                   ← Next.js App Router (páginas + API Routes)
│   ├── components/
│   │   ├── bi/                ← Componentes BI (dashboards · chat)
│   │   └── ui/                ← Componentes base
│   └── lib/
│       ├── auth/              ← Sesión propia BI (login cerrado por defecto)
│       ├── bi/                ← Motor NL→SQL (candados 1-6)
│       ├── catalogo/          ← Catálogo dinámico (candado 8)
│       ├── seguridad/         ← Tenancy + validación SQL (candados 11, 13)
│       └── observabilidad/    ← Traza por consulta (candado 12)
├── scripts/                   ← seed · réplica pg_logical · verificar-índices · deploy
├── prisma/                    ← schema (catálogo BI + logs + cache) + migraciones + MVs
├── tests/
│   └── e2e/                   ← Calidad
├── docker-compose.yml         ← app BI v2 + Postgres réplica (sin Superset ni Vanna)
├── AGENTS.md                  ← reglas para IA en el repo de código
├── README.md
└── package.json
```

---

## §8 · Fases de implementación

1. **Fase 1:** Esqueleto sobre base PI + login propio (cerrado por defecto) + dominio + CI/CD
2. **Fase 2:** Motor NL→SQL con 1 modelo + catálogo + validador
3. **Fase 3:** Dashboards nativos en Next.js + chat UI
4. **Fase 4:** Deploy limpio en Hostinger + verificación en vivo

**Un solo motor NL→SQL (Ollama + Postgres réplica) sirve a todos los frontends.**

---

## §9 · Correcciones honestas · patrón adoptado permanente

Si CEO (o cualquier rol) detecta un error propio, se asume como I-XX marcada `"corrección honesta <rol>"`. **No se esconde.**

**Regla derivada · verificar en fuente pre-radicación:**
Antes de que CEO radique un brief a Fábrica · consulta a Fábrica los puntos técnicos dudosos (grep · BD · comportamiento actual).

---

## §10 · Riesgos silenciosos vigilados

- **Modelo Ollama alucinando SQL** → structured outputs + validador post estricto + revisión humana (candados 2, 5, 6)
- **Consulta BI tumba prod** → Postgres réplica read-only obligatorio · BI jamás toca la base transaccional de PI
- **Réplica desactualizada o MVs rotas** → healthcheck del BI las detecta y alerta
- **Cambios en la BD de PI** → requieren actualizar catálogo BI y MVs manualmente (proceso documentado)
- **Ollama en Mac cae · chat no responde** → alerta Telegram · los dashboards nativos siguen funcionando (aislamiento)
- **Rate limit no aplicado** → candado adicional desde Fase 1 (límite de consultas por usuario en constantes)

---

## §11 · Enmienda de esta constitución

Se enmienda por:
1. Decisión Jelkin explícita en acta ARQ-BI-XX
2. Aprendizaje crítico (I-XX que exponga hueco no cubierto)
3. Retroalimentación de Calidad tras campaña de pruebas

Cada enmienda:
- Incrementa versión del documento (v1.0 → v1.1 · etc)
- Actualiza fecha F3C
- Registra la decisión como D-XX

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-09-01 (COT) |
| **Autor** | CEO IDC |
| **Aprobado por** | Jelkin Zair Carrillo Franco |
| **Fuente** | Constitución BI v1 (005) adaptada + decisiones del dueño (dominio, stack, 1 modelo, eliminación de Superset/Vanna/jurado) |
| **Estado** | 🟢 Vigente · vinculante para todos los roles BI v2 |

# CONSTITUTION.md · Producto 005 · BI · Inteligencia de Negocio

> **Este documento es LEY.** Toda decisión técnica, de diseño o de operación se somete a esta constitución. Si una tarea la contradice, se consulta ANTES de proceder.
> **Origen:** aprendizajes destilados del proyecto PI (58 patrones · 12 correcciones honestas evitadas en 24h · 17 SPECs cerradas en 48h el 26-27 ago). No repetimos errores caros.
> **Autor:** CEO IDC · **Aprobado por:** Jelkin Zair Carrillo Franco · **F3C:** 2026-08-28

---

## §0 · Identidad del proyecto

- **Nombre canónico:** `Producto 005 · BI` (o simplemente `BI`)
- **Nombre carpeta:** `005-2026-BI-INTELIGENCIA-NEGOCIO`
- **Propósito:** plataforma de inteligencia de negocio para IDC · uso inicial admin (Jelkin) · evolución comercial futura (dashboards Premium para colegios y padres dentro de PI)
- **Alcance Fase 1:** interno · Jelkin + Fábrica · dashboards operativos + chat NL con LLM local
- **Alcance Fase 2:** integrar módulo colegio dentro de la app PI (`pi.innovadataco.com/dashboard/colegio/analytics`) como Plan Premium
- **Alcance Fase 3:** integrar módulo padre dentro de PI · chat IA personalizado
- **Regla del nombre:** manda el NOMBRE nunca el número. Se dice `BI · SPEC-XXX` · `BI · A-XX` · `BI · I-XX` · `BI · D-XX`
- **Numeración documental (correlativa unificada por tipo):** `SPEC-001`, `SPEC-002`... · `A-01`, `A-02`... · `I-01`, `I-02`... · `D-01`, `D-02`... · `R-001`, `R-002`... · `ACTA-ARQ-01`, `ACTA-ARQ-02`...

---

## §1 · Roles y candado de escritura (NO NEGOCIABLE)

Las 5 sesiones que trabajan en BI **no comparten contexto ni memoria**. Cada una tiene un rol específico y candados de escritura duros.

| Rol | Escribe | **NUNCA escribe** |
|---|---|---|
| **Jelkin Zair Carrillo Franco** | Decisiones de negocio · plata · legal · prioridad · valida en pruebas · ejecuta secretos y `deploy-bi-prod.sh` | — |
| **CEO** | BRIEFS en `05-ENTREGABLES/` · directrices a Fábrica y Calidad · `ESTADO.md` · actas de mesa estratégica | INSTRUCTIVOS · prompts para Desarrollo · specs · código |
| **Fábrica** | INSTRUCTIVOS en `03-EJECUCION/02-RADICACIONES/` · prompts para Desarrollo · reportes al CEO · auditoría spec+plan | BRIEFS · specs · código de producto |
| **Desarrollo** | SPECS con Spec Kit · código de producto · señales cortas | Briefs · instructivos · deploy |
| **Calidad** | RECORRIDOS de prueba (solo `tests/e2e/**` y `src/lib/e2e/journeys/**` por PR) · I-XX · plan de pruebas · reportes al CEO | Código de producto · briefs · instructivos · deploy · escrituras en BD prod · leer o escribir contraseñas |

**Cadena de decisión (única):** Jelkin decide → CEO escribe brief → Fábrica traduce a instructivo + prompt → Desarrollo escribe spec e implementa → Fábrica audita → Jelkin despliega → Calidad valida en vivo.

**Comunicación entre sesiones:** las sesiones no se hablan entre sí. Jelkin es cartero · CEO coordinador. Ningún rol escribe directo a otro. Detalle en `PROMPT-REAPERTURA-ROLES.md` §0.

---

## §2 · Cinco Reglas de Oro (DoD mínima · ninguna se salta)

Heredadas de la metodología PI · aplican tal cual:

1. **Spec Kit en todo** · una feature = una SPEC. Sin excepciones.
2. **Subir a GitHub** · commit + push tras cada fase. Sin excepciones.
3. **Siempre pruebas** · unitarias + integración + E2E · payload real del componente.
4. **Siempre desplegable · que compile NO basta** · verificación en vivo con el rol que corresponda.
5. **Siempre documentar** · `cierre.md` por SPEC · `tasks.md` con casillas marcadas · `Status` actualizado.

---

## §3 · Los 15 Candados obligatorios (destilados de PI · anti-alucinación LLM + disciplina)

### CATEGORÍA A · Anti-alucinación LLM (motor rúbrica aplicado al chat NL→SQL)

#### Candado 1 · Enum cerrado en JSON Schema · sin strings libres
Cada consulta LLM devuelve `{tabla: enum[TABLAS_PERMITIDAS], columnas: [enum], operadores: [enum], filtros_col: enum[]}` con `additionalProperties: false`. Imposible inventar tabla o columna. Origen: `rubrica.ts:66-71` · `schemas.ts:15-28` de PI.

#### Candado 2 · Structured outputs · temp 0 · seed 42 · nunca parseo manual
Ollama con `format: schema` nativo. Si no parsea, se tira · no se rescata a la fuerza. Origen: `ollama-client.ts:64-68` de PI.

#### Candado 3 · Índices numéricos vs strings verbatim
Presento catálogo enumerado, LLM devuelve `{tabla_idx: 3, cols_idx: [1,4]}`. Servidor traduce a nombres reales. Elimina paráfrasis y typos. Origen: `rubrica.ts:66-71` de PI.

#### Candado 4 · Descomposición en checks atómicos factuales
En vez de "¿qué me pides?" → checks decisivos: *¿qué métrica? ¿qué dimensión temporal? ¿qué filtros? ¿qué agrupación?*. Deny-by-default: si falta uno, no se genera SQL · se pide clarificación. Origen: `rubrica-semilla.ts` + `rubrica.ts:197-211` de PI.

#### Candado 5 · Jurado multi-modelo con voto de mayoría
2-3 modelos generan SQL en paralelo. Canonicalizar AST. Si ≥2/3 NO coinciden → estado REVISION · no se ejecuta. Origen: `rubrica.ts:312-349` de PI.

#### Candado 6 · Reglas determinísticas ANTES y DESPUÉS del LLM
- Pre: regex detecta intención destructiva (`DROP`, `DELETE`, `UPDATE`, "borra", "elimina") · bloquea antes de llamar al LLM
- Post: valida que SQL no toque columnas prohibidas · tenga `LIMIT` · no cross-join sin claves
- Guardas NUNCA reclasifican · solo escalan a revisión humana

Origen: `guardas-decision.ts:96-193` de PI.

#### Candado 7 · Cache semántico de veredictos HUMANOS (no de LLM)
Tabla `nl_query → sql_aprobado` alimentada por operadores. Embed de nueva pregunta busca hits ≥ umbral y devuelve SQL humano. LLM previo NO va al cache. Origen: `cache-semantico.ts:19-41` de PI.

### CATEGORÍA B · Datos como fuente única · nunca inventar

#### Candado 8 · Catálogo como DATO editable en BD (no en prompt)
Tabla `CatalogoBI` con tablas · columnas · sinónimos · glosario métricas · ejemplos NL→SQL. Schema JSON del LLM se construye dinámicamente contra el catálogo vigente. Cambio de esquema = UPDATE · no despliegue.

#### Candado 9 · Si no hay dato · el chat NO INVENTA
Regla dura: cuando el LLM sale con "no encontré datos", plantilla determinista: *"No hay datos operativos para esa consulta en tu ámbito. Puede ser que aún no se registren eventos de esa categoría · o el criterio sea muy específico."* Nunca completa con supuestos.

#### Candado 10 · Plantillas deterministas para toda salida narrativa al usuario
LLM genera SQL + elige plantilla. La cifra numérica viene del ResultSet · NUNCA texto libre del modelo. *"En tu colegio hubo {N} reportes en {periodo}, la categoría más frecuente fue {X}"* con slots vinculados. Origen: D-23 de PI.

### CATEGORÍA C · Multi-tenancy · privacidad · auditoría (Ley 2564 · Ley 1581)

#### Candado 11 · Guard de tenancy · rechazo automático de SQL sin `WHERE tenant_id = :sesion`
3 capas (middleware app · prompt engineering · validación SQL post-generación). Ningún colegio/padre puede ver datos ajenos. Test: "usuario A intenta URL de tenant B en cada endpoint" (D-89 PI). Rechazo automático · nunca ejecuta.

#### Candado 12 · Traza completa por consulta (expediente)
Cada consulta guarda: prompt · esquema visto · SQL propuesto · plan ejecución · filas devueltas · plantilla usada · latencia por paso · usuario · IP · timestamp. Panel `/admin/consultas/{id}`. Única forma de mejorar el motor. Origen: D-22 de PI.

#### Candado 13 · Serialización + grep PII/secrets antes de emitir al usuario
Toda respuesta al usuario pasa por sanitizer que busca patrones (`\d{10}` · emails · direcciones · nombres del schema). Ratchet grep-based CI. Cero PII cruda escapa. Origen: I-28 de PI.

### CATEGORÍA D · Metodología y disciplina

#### Candado 14 · Verde en CI ≠ funciona · verificación en vivo obligatoria
Antes de decir CUMPLE: entrar a la app · rol correspondiente · recorrer · reportar qué viste. Aplica a cada tablero · cada consulta · cada refresh. Origen: 11 defectos encontrados por Jelkin en 2h con CI verde (PI 26-ago).

#### Candado 15 · Verificar en fuente · nunca suponer (con doble vía si es grave)
`git`, `gh`, BD real · nunca solo grep literal. Si `grep` da negativo · confirmar por segundo camino (AST · ejecución · BD). Origen: I-138 de PI (separadores numéricos ocultaron colisión workers).

---

## §4 · Cero-negociables adicionales (candados heredados de PI)

- **Migraciones aditivas · jamás destructivas.** Nunca `prisma migrate reset` ni nada que borre datos. Rebase que borre migración o revierte `schema.prisma` = HALLAZGO · PARA.
- **Un solo worker (advisory lock).** Exactamente un worker activo · un segundo termina con código 2. Tabla `WORKER_LOCK_IDS` versionada con `unique` en CI.
- **Todo worker con pg-boss llama `ensureQueue`** antes de `work/schedule`. Test de arranque contra BD vacía.
- **Healthcheck obligatorio** para todo servicio del compose · deploy no autorizado sin él. Ratchet grep en `docker-compose.yml`.
- **Cero secretos en chat/commits/docs** (regla dura I-22/I-142/I-144 de PI). Valores solo en `.env` fuera de git y en `~/.config/bi-e2e/.env.e2e` (permisos 600). En documentos y chat siempre puntero (`ver INVENTARIO-DE-SECRETOS.md`).
- **`Date` nativo prohibido** para aritmética temporal. `date-fns-tz` obligatorio · `TZ=America/Bogota` en contenedores · `@db.Timestamptz(6)` explícito. Origen: D-69 de PI.
- **Seed idempotente `upsert` con `update:{}`** (no pisar valores custom). Test que corre seed 2 veces y aserta cero cambios en la 2ª pasada.
- **Ratchet de índices post-migración en CI** (crítico con pgvector · HNSW). Script `verificar-indices-post-migrate.mjs` compara `pg_indexes` real vs lista canónica. Origen: A-45 PI.
- **Deploy explícito por `deploy-bi-prod.sh`** · nunca auto-deploy desde push. `main` sincronizado con `feature/bi-scaffolding`.
- **Push único al final del SPEC.** Gate LOCAL completo por fase antes de PUSH.
- **Máximo 2 iteraciones de CI por síntoma.** Al 3er rojo del mismo síntoma → PARA + avisa a CEO. Origen: D-55 PI.
- **`rm -rf .next` (o equivalente Vite/Turbopack) antes de creer un build.** Cachés viejas causan verdes falsos. Origen: AGENTS.md PI.
- **Un Desarrollo · un worktree.** `git worktree add ../bi-<SPEC>` obligatorio antes de arrancar en paralelo. Origen: D-82 PI (evita I-109 cuasi-catástrofe).
- **Prohibido a la IA correr `DROP`/`TRUNCATE`/`migrate reset`** sin autorización humana firmada. `.claude/settings.local.json` deniega por default.

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

## §6 · Estructura de radicaciones

**Ubicación:** `03-EJECUCION/02-RADICACIONES/BI · INSTRUCTIVO-XXX.md`

**Plantilla obligatoria (D-44 de PI):**
- Contexto puente (máximo 5 líneas)
- Cadena de comandos con compuerta explícita
- Leer primero (documentos que consumir)
- Candados aplicables
- Señales esperadas
- Criterios de auditoría

**Primera línea del prompt siempre:**
```
CONTEXTO: BI (repo productos/005-2026-BI-INTELIGENCIA-NEGOCIO) · SPEC-XXX
```

---

## §7 · Comunicación · dos canales simétricos con radicado correlativo

- `06-COMUNICACIONES/REPORTES-A-CEO/REPORTE-NNN-yyyy-mm-dd-HHMM.md`
- `06-COMUNICACIONES/DIRECTRICES-A-FABRICA/DIRECTRIZ-NNN-yyyy-mm-dd-HHMM.md`
- `06-COMUNICACIONES/DIRECTRICES-A-CALIDAD/DIRECTRIZ-NNN-yyyy-mm-dd-HHMM.md`

**NNN correlativo permanente · único para todos los emisores.** No hay "R-01 de Fábrica" y "R-01 de Calidad" a la vez · el siguiente número disponible es siempre el próximo.

**Bloque F3C al pie de cada documento:**
```
| Campo | Valor |
|---|---|
| Radicado | NNN |
| F3C | YYYY-MM-DD HH:MM COT |
| Emisor | quién |
| Destinatario | quién |
| Estado | 🟢 emitida · ☐ pendiente · ☑ cerrada |
| Leído por destinatario | ☐/☑ + fecha |
| Acciones tomadas | descripción |
| Cerrada | ☐/☑ + fecha |
| Requiere respuesta en | referencia |
```

---

## §8 · Ramas y deploy

- **Rama de trabajo:** `feature/bi-scaffolding` (equivalente al `feature/001-scaffolding` de PI)
- **Rama tronco:** `main` (sincronizada · no despliega automáticamente)
- **Deploy:** solo por `scripts/deploy-bi-prod.sh` ejecutado por Jelkin (bloqueado por classifier para IA)
- **Instrucciones deploy versionadas en `scripts/deploy-bi-prod.sh`** · nunca en chat ni memoria

---

## §9 · Estructura del repo de código

```
productos/005-2026-BI-INTELIGENCIA-NEGOCIO/
├── .specify/
│   ├── memory/
│   │   └── constitution.md   ← copia sincronizada de este archivo
│   └── specs/                 ← todas las SPEC-XXX de Desarrollo
├── src/
│   ├── app/                   ← Next.js app router
│   ├── lib/
│   │   ├── ai/                ← motor NL-to-SQL · candados 1-10
│   │   ├── catalogo/          ← catálogo dinámico (candado 8)
│   │   ├── seguridad/         ← tenancy + validación SQL (candados 11, 13)
│   │   └── observabilidad/    ← traza por consulta (candado 12)
│   └── ...
├── scripts/                   ← workers · seed · deploy · verificar-indices
├── prisma/                    ← schema BD warehouse + migraciones
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                   ← Calidad
├── docker-compose.yml         ← Superset · Vanna · Bot Telegram · Postgres réplica
├── docker-compose.prod.yml
├── AGENTS.md                  ← reglas para IA en el repo de código
├── README.md
└── package.json
```

---

## §10 · Roadmap por fases

**Fase 1 · Fundamento e interno (7-9 semanas)**
- Constitución + estructura repo gestión y código (esta semana)
- Superset + Vanna+Ollama + Postgres réplica + Bot Telegram
- Frontend interno custom (Next.js · app `tablero.pi.innovadataco.com`)
- 5 dashboards MVP: Ejecutivo · Motor IA · Comercial · Operativo · Salud
- Chat contextual conectado a Ollama
- Uso: Jelkin + Fábrica

**Fase 2 · Módulo colegio en PI (4-5 semanas · cuando cierre 1er venta colegio)**
- Nueva ruta `pi.innovadataco.com/dashboard/colegio/analytics`
- Multi-tenant estricto (candado 11)
- Vendido como Plan Colegio Premium

**Fase 3 · Módulo padre en PI (3-4 semanas · cuando volumen justifique)**
- Nueva ruta `pi.innovadataco.com/dashboard/padre/insights`
- Chat con contexto padre + datos anonimizados k-anonymity
- Vendido como Plan Padre Premium

**Backend BI compartido entre las 3 fases · UN Vanna+Ollama+Postgres+Superset sirve a los 3 frontends.**

---

## §11 · Correcciones honestas · patrón adoptado permanente

Si CEO (o cualquier rol) detecta un error propio, se asume como I-XX en `03-EJECUCION/04-INCIDENCIAS.md` marcada `"corrección honesta <rol>"`. **No se esconde.** Origen: precedentes I-66 · I-68 · I-69 de PI · adoptado como cultura tras 12 correcciones honestas evitadas en 24h el 27-ago.

**Regla derivada · verificar en fuente pre-radicación:**
Antes de que CEO radique un brief a Fábrica · consulta a Fábrica los puntos técnicos dudosos (grep · BD · comportamiento actual). Esto evitó 12 defectos de diseño en un día.

---

## §12 · Riesgos silenciosos vigilados

- **Modelo Ollama alucinando SQL** → jurado 2/3 + validador post + revisión humana (candados 5, 6)
- **Consulta BI tumba prod** → Postgres réplica read-only obligatorio (§3 categoría B implícito)
- **Ollama en Mac cae · chat no responde** → alerta Telegram · dashboards Superset siguen funcionando (aislamiento)
- **Rate limit no aplicado** → candado adicional en Fase 1 (RATE_LIMIT_QUERIES_POR_USUARIO en constantes)
- **Multi-tenant filtration en Fase 2/3** → test cross-tenant obligatorio antes de merge de cada spec que toque módulos comerciales

---

## §13 · Enmienda de esta constitución

Se enmienda por:
1. Decisión Jelkin explícita en acta ARQ-BI-XX
2. Aprendizaje crítico (I-XX que exponga hueco no cubierto)
3. Retroalimentación de Calidad tras campaña de pruebas

Cada enmienda:
- Incrementa versión del documento (v1.0 → v1.1 · etc)
- Actualiza fecha F3C
- Registra en `03-EJECUCION/05-DECISIONES.md` como D-XX

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 (madrugada COT) |
| **Autor** | CEO IDC |
| **Aprobado por** | Jelkin Zair Carrillo Franco |
| **Fuente** | Destilado de 58 aprendizajes de PI + 15 candados obligatorios + patrones motor rúbrica |
| **Estado** | 🟢 Vigente · vinculante para todos los roles BI |
| **Sincronización** | Copia debe existir en `productos/005-2026-BI-INTELIGENCIA-NEGOCIO/.specify/memory/constitution.md` |

# SPECKIT CONSTITUTION — 000-2026-MODELOS

> **Versión:** 1.0.0
> **Fecha:** 2026-07-29
> **Stack:** Python 3.9+ (stdlib únicamente) + HTML/CSS/JS vanilla (un archivo)
> **Runtime:** el python3 del sistema macOS; sin npm, sin pip, sin build
> **Propósito:** herramientas internas de gestión de los modelos IA de la fábrica IDC
> **Autor:** ZEUS (excepción de gobernanza: herramienta interna, orden directa del CEO — no es producto de cliente, no pasa por ODIN)

---

## 1. PRINCIPIOS DEL PRODUCTO

### 1.1 Propósito y alcance
`000-2026-MODELOS` agrupa herramientas de **observabilidad y gestión del consumo de los
modelos IA** que usa la fábrica (Claude Code, Ollama, etc.). La primera pieza es el
**Centro de Control de Consumo de Tokens** (SPEC-001).

### 1.2 MONITOREAR, NUNCA ACTUAR (inquebrantable)
Las herramientas de este producto son **solo lectura**. Observan transcripciones, logs y
metadatos; **jamás** matan procesos, modifican sesiones, editan configuración de agentes ni
envían comandos. Toda acción la decide y ejecuta el humano. Una herramienta que necesite
actuar no pertenece a este producto.

### 1.3 Los datos no salen de la Mac (inquebrantable)
Todo corre en `127.0.0.1`. Prohibido: telemetría, llamadas a APIs externas, CDNs
(fuentes/librerías se sirven locales o no se usan), analytics. El contenido de las
transcripciones es sensible (incluye trabajo de clientes): ni un byte a la red.

### 1.4 Cero dependencias (inquebrantable)
Python **stdlib únicamente** — sin pip, sin venv, sin node_modules. El frontend es HTML/CSS/JS
vanilla en un solo archivo. Razón: esta máquina ya sufrió un binario de terceros sin firmar
con telemetría (caso tokensave, 2026-07-29); las herramientas internas no repiten ese error.
Sin cadena de suministro, sin build, sin actualizador.

### 1.5 Solo lectura del disco ajeno
Lee `~/.claude/projects/**/*.jsonl` y los metadatos de la app de escritorio
(`~/Library/Application Support/Claude/claude-code-sessions/**`) en modo lectura. Nunca
escribe fuera de su propia carpeta. Si un archivo no se puede parsear, se salta — nunca
se corrige ni se toca.

## 2. PRINCIPIOS TÉCNICOS

| Capa | Tecnología | Política |
|------|-----------|----------|
| Servidor | `http.server` (stdlib) | bind exclusivo a 127.0.0.1; puerto 8899 |
| Datos | lectura directa de JSONL | tolerante a líneas corruptas; sin caché en disco |
| Frontend | HTML+CSS+JS vanilla, un archivo | sin frameworks, sin CDN, sin fuentes externas |
| Visualización | SVG generado en el cliente | paleta validada (dataviz IDC, modo oscuro) |
| Testing | `unittest` (stdlib) | los cálculos (agregación, alertas) tienen prueba |
| Estilo UI | tipo "mission control" NASA | superficie oscura, sans del sistema, tabular-nums en columnas |

## 3. REGLAS DE CALIDAD
1. Toda métrica mostrada debe ser **reproducible** desde las transcripciones (nada inventado).
2. El peso en dólares es **referencial** (tarifa API pública); en plan Max se etiqueta
   siempre como "peso comparativo", nunca como factura.
3. Las alertas llevan **siempre** la acción recomendada al lado (qué hacer, no solo qué pasa).
4. Umbrales de alerta centralizados en un solo lugar del código, documentados en el spec.

## 4. GOBERNANZA
- Cambios a esta constitución: solo ZEUS con aprobación del CEO.
- Specs nuevas siguen el flujo Spec Kit: specify → plan → tasks → implement, con artefactos
  en `specs/NNN-nombre/`.
- Ramas y staging: rigen las reglas del monorepo (`../AGENTS.md`) — trabajo en
  `feature/001-scaffolding`, staging solo de `000-2026-MODELOS/...`, merge a `main` como
  liberación auditada.

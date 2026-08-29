# SPEC-011 · Motor NL→SQL · Fachada Next.js (candado 1)

> **Radicado:** BI · SPEC-011 · sub-fase 1 de INSTRUCTIVO-007
> **F3C:** 2026-08-28
> **Rama:** `work/bi-SPEC-011-vanna-motor` (base `main`)
> **Depende de:** SPEC-007 CUMPLE (schema BI) · SPEC-008 CUMPLE (seed catálogo) · SPEC-009 CUMPLE (vistas materializadas)
> **Cierra parcial:** BI · I-06 (motor.ts stub sin candados)
> **Sub-SPECs hermanas:** SPEC-012 · SPEC-013 · SPEC-014
> **Constitución:** aplica candados 1 · 6a · 6b · 7 · 8 · 10 · 11 · 12 · 13 · 14 · 15 · 17

---

## 1. Problema

`src/lib/bi/motor.ts` es un stub de 4 líneas que retorna string fijo. No aplica ningún candado anti-alucinación. Cualquier llamada de un futuro chat NL→SQL no tiene guardas, ni cache, ni catálogo, ni sanitizer, ni traza.

## 2. Objetivo

Reemplazar el stub por la **fachada única Next.js** (candado 1: única puerta a Ollama/Vanna en toda la app) que:

1. Recibe una pregunta en lenguaje natural + contexto de usuario.
2. Ejecuta pre-guard determinístico (candado 6a).
3. Consulta cache semántico (candado 7).
4. Delega la generación de SQL a `bi-vanna` (FastAPI · SPEC-012) — no importa Ollama directo.
5. Ejecuta post-validator sobre el SQL devuelto (candado 6b).
6. Ejecuta la consulta contra la réplica read-only y sanea el ResultSet (candado 13).
7. Elige plantilla determinista (candado 10) y devuelve JSON estructurado.
8. Registra traza completa en `bi_consulta_log` (candado 12).

## 3. Alcance

**Dentro:**

- `src/lib/bi/motor.ts` — reemplaza stub · exporta `preguntar(input): Promise<RespuestaMotor>`.
- `src/lib/bi/pre-guard.ts` — regex bloqueo destructivo (`DROP`, `DELETE`, `UPDATE`, `TRUNCATE`, `ALTER`, `GRANT`, `borra`, `elimina`, `vacía`). Devuelve `{permitido, razon}`.
- `src/lib/bi/post-validator.ts` — valida el SQL devuelto por `bi-vanna`: solo `SELECT`, whitelist de tablas del catálogo activo, `LIMIT ≤ 1000` obligatorio, sin columnas `excluida=true`, sin cross-join sin `ON`, filtro tenant si el rol es `SCHOOL_ADMIN` o `PARENT` (stub · candado 11).
- `src/lib/bi/sanitizer.ts` — detecta y enmascara PII sobre el ResultSet (patrones: teléfono 10 dígitos CO, email, cédula, direcciones con `#`, nombres del schema PI). Devuelve filas saneadas + flags.
- `src/lib/bi/plantillas.ts` — 4 plantillas deterministas: `sin-datos`, `un-numero`, `tabla`, `grafico`. Sin texto libre del LLM.
- `src/lib/bi/cache-semantico.ts` — `buscarSimilar(embedding, umbral)` + `guardarAprobacion(preguntaNL, sql, aprobadoPor)`. Delega a Prisma sobre `bi_cache_semantico` con `pgvector`.
- `src/lib/bi/catalogo.ts` — lee `bi_catalogo_tabla` + `bi_catalogo_columna` filtrado por `rolesPermitidos` del usuario, construye JSON Schema dinámico con `additionalProperties: false` y enum cerrado (candado 8 + 1).
- `src/lib/bi/tenancy-guard.ts` — **STUB** que retorna `{permite: true, filtro: null}` para `ADMIN`; para `SCHOOL_ADMIN`/`PARENT` retorna `{permite: false, razon: "activación diferida a INSTRUCTIVO-009"}`. Se completa en SPEC de multi-tenant runtime.
- `src/lib/bi/vanna-client.ts` — HTTP client hacia `bi-vanna:8001/generate`. Timeout 60s primera request · 15s caliente. Payload: `{preguntaNL, schemaJSON, contexto}`. Respuesta: `{sqlGenerado, votosJurado, consenso, latencias}`.
- `src/lib/bi/embedding.ts` — llama Ollama `nomic-embed-text` para vectorizar la pregunta (768d). Ollama URL viene de `OLLAMA_BASE_URL` (env).
- `src/app/api/bi/preguntar/route.ts` — endpoint POST · valida input Zod · llama `motor.preguntar()` · devuelve JSON con `estado ∈ {OK, REVISION, RECHAZADO}`.
- `src/lib/bi/tipos.ts` — tipos compartidos (`EntradaMotor`, `RespuestaMotor`, `EstadoRespuesta`, `PlantillaId`).
- `tests/unit/bi/motor.test.ts` — 20+ tests unit (uno funcional + uno de "simulación de daño" por cada candado 1, 6a, 6b, 7, 8, 10, 12, 13).
- `scripts/ratchets/motor-plantillas-completas.sh` — nuevo ratchet grep-based: asegura que las 4 plantillas están definidas.

**Fuera (cubierto por sub-SPECs hermanas):**

- Jurado 3-modelos + AST canonicalization (SPEC-012 · bi-vanna Python)
- Cualquier llamada directa a Ollama para SQL (SPEC-012)
- UI del chat + Vega-Lite (SPEC-013)
- Tests integración end-to-end con las 5 preguntas del brief (SPEC-014)
- Multi-tenant runtime completo (INSTRUCTIVO-009)
- Bot Telegram (INSTRUCTIVO-008)

## 4. Interfaz pública

```ts
export interface EntradaMotor {
  preguntaNL: string;
  usuario: { id: string; rol: "ADMIN" | "SCHOOL_ADMIN" | "PARENT" };
  contextoDashboard?: string;
  filtrosContexto?: Record<string, unknown>;
}

export type EstadoRespuesta = "OK" | "REVISION" | "RECHAZADO";
export type PlantillaId = "sin-datos" | "un-numero" | "tabla" | "grafico";

export interface RespuestaMotor {
  estado: EstadoRespuesta;
  razon?: string;                    // razón cuando estado != OK
  respuestaNarrativa: string;        // siempre viene de plantilla determinista
  plantilla: PlantillaId;
  tablaDatos: Array<Record<string, unknown>>;
  graficoSpec?: unknown;             // Vega-Lite (opcional · lo pinta SPEC-013)
  sqlGenerado?: string;              // solo si estado ∈ {OK, REVISION}
  votosJurado?: Array<{ modelo: string; sqlCanonico: string }>;
  consenso?: boolean;
  cacheHit: boolean;
  llamadasLlm: number;               // pre-guard debe garantizar 0 cuando estado=RECHAZADO por destructivo
  latencias: { totalMs: number; preGuardMs: number; cacheMs: number; vannaMs: number; postValidatorMs: number; sqlMs: number; sanitizerMs: number };
  consultaLogId: string;             // FK a bi_consulta_log
}

export async function preguntar(input: EntradaMotor): Promise<RespuestaMotor>;
```

## 5. Endpoint HTTP

`POST /api/bi/preguntar`

Body (Zod validado):
```json
{ "preguntaNL": "cuántos reportes hoy", "usuario": {"id": "u1", "rol": "ADMIN"}, "contextoDashboard": null, "filtrosContexto": null }
```

200 OK — devuelve `RespuestaMotor` verbatim.
400 · body inválido.
401 · sin sesión.
500 · fallo interno (log capturado + `consultaLogId` en el body).

## 6. Criterios de aceptación (compuerta §4)

- [ ] Cero imports de `ollama`/`vanna` fuera de `motor.ts` y `vanna-client.ts` y `embedding.ts` (ratchet `imports-llm-solo-motor.sh` sigue pasando · se ajusta whitelist a esos 3 archivos).
- [ ] `motor.ts` exporta `preguntar` con la firma de §4 · cada rama de decisión escribe `bi_consulta_log`.
- [ ] `pre-guard.ts` bloquea DROP/DELETE/UPDATE/TRUNCATE/ALTER/GRANT y equivalentes en español; test simulación de daño: agregar "elimina" al texto → RECHAZADO con `llamadasLlm=0`.
- [ ] `post-validator.ts` rechaza SQL que use una tabla no listada en `bi_catalogo_tabla` (verificado con test).
- [ ] `sanitizer.ts` enmascara teléfono/email/cédula en un ResultSet sintético.
- [ ] `catalogo.ts` construye JSON Schema con `additionalProperties: false` para cada campo objeto (ratchet `no-additional-properties-true.sh` sigue pasando).
- [ ] `tenancy-guard.ts` (STUB) niega `SCHOOL_ADMIN`/`PARENT` con razón explícita.
- [ ] 20+ tests unit verdes · cobertura de cada candado listado.
- [ ] Sin secretos en chat/commits/docs (ratchet `cero-secretos.sh` verde).
- [ ] `research.md` documenta: (a) decisión de dejar el jurado en Python y no en Node, (b) formato del JSON Schema dinámico, (c) tabla mapping candado → archivo → test.
- [ ] Commit spec+plan pusheado antes de implementar (candado 17).

## 7. Fuera de alcance / decisiones diferidas

| Tema | Diferido a |
|---|---|
| Jurado 2/3 en Python + AST canonicalization | SPEC-012 |
| UI de chat + botones 👍👎 | SPEC-013 |
| Tests de integración end-to-end (5 preguntas del brief) | SPEC-014 |
| Multi-tenant runtime completo (activa `tenancy-guard`) | INSTRUCTIVO-009 |
| Bot Telegram consume `/api/bi/preguntar` | INSTRUCTIVO-008 |
| Retraining Vanna con feedback humano | Deuda de mantenimiento Fase 1 |

## 8. Riesgos

- **`bi-vanna` no existe todavía:** cliente HTTP en `vanna-client.ts` se implementa contra la especificación de SPEC-012. Tests unit usan `msw` o mock manual para simular respuestas. Integración real ocurre en SPEC-014.
- **Ollama para embeddings puede caer:** si `nomic-embed-text` no responde en 5s → salta cache · continúa a Vanna · anota en `bi_consulta_log.fuenteCache=false` con razón. No es error terminal.
- **Prisma `Unsupported("vector(768)")`:** el cache semántico requiere queries raw para `<=>`. Se hace con `$queryRaw`. Ratchet `cero-sql-raw.sh` ya excluye `cache-semantico.ts` (verificar antes de commit).

---

## 📋 Control del documento

| Campo | Valor |
|---|---|
| **Radicado** | BI · SPEC-011 |
| **F3C** | 2026-08-28 |
| **Autor** | BI-Dev 1 |
| **Aprobado** | pendiente REVISO Fábrica BI-2 |
| **Estado** | 🟡 spec+plan en compuerta §4 |

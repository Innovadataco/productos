# Plan de implementación: SPEC-207 — Parche motor SPAM dominancia (002-PI-140)

## Resumen

Añadir una hard-rule determinística anti-spam-publicitario antes de la guarda de dominancia, bajar el umbral de dominancia a 0.33 y loggear modelos de rúbrica que no responden. Tres cambios acoplados que cierran I-105.

## Contexto técnico

- Motor de clasificación en `src/lib/ai/**`.
- Guardas en `src/lib/ai/guardas.ts`.
- Sandbox/rúbrica en `src/lib/ai/sandbox.ts`.
- Seed de parámetros en `prisma/seed.ts`.
- Tests con Vitest.

## Constitution Check

- ✅ Sin multimedia.
- ✅ Presunción de inocencia: lenguaje estadístico, regla es "posible spam".
- ✅ IA local no se toca en su núcleo; solo guardas y logging.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes (solo lectura para regex).

## Estructura del proyecto

### Documentación
```text
specs/207-parche-motor-spam-dominancia/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── endpoints.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
prisma/seed.ts                              # spam.dominancia_umbral=0.33 + spam.dominios_acortadores
src/lib/ai/guardas.ts                       # hard-rule spam_publicitario_deterministico
src/lib/ai/sandbox.ts                       # log modelo sin respuesta
src/lib/ai/guardas.test.ts                  # tests de la hard-rule
src/lib/ai/__fixtures__/spam-textbook.ts    # texto RPT-QFUHE8
```

## Cambios de código

### 1. Seed
- En `prisma/seed.ts` sección de rúbrica SPAM / parámetros del motor:
  - `spam.dominancia_umbral=0.33` con `update: { valor: "0.33" }` (excepción documentada: se fuerza el nuevo default por decisión de diseño de SPEC-207).
  - `spam.dominios_acortadores` JSON con lista inicial: `["bit.ly","tinyurl","is.gd","t.co","cutt.ly","ow.ly","buff.ly"]`.

### 2. Hard-rule anti-spam-publicitario
- Nuevo archivo o extensión de `src/lib/ai/guardas.ts`:
  - `detectarSpamPublicitarioDeterministico(textoOriginal: string, dominiosAcortadores: string[]): boolean`.
  - Cuenta hashtags, links acortados, patrón dinero+urgencia+CTA, emojis monetarios.
  - Devuelve true si ≥2 señales.
- Integrar en el pipeline de guardas ANTES de `spam_dominancia`:
  - Si la hard-rule dispara, retorna `estadoFinal: "POSIBLE_SPAM"`, `reglasAplicadas: [..., "spam_publicitario_deterministico"]`.
  - No se ejecuta la rúbrica LLM innecesariamente (o se ejecuta pero se ignora su veredicto).

### 3. Log de modelo sin respuesta
- En `src/lib/ai/sandbox.ts`, en el catch/timeout del llamado a modelo:
  - `logWorker({ tipo: "RUBRICA_MODELO_SIN_RESPUESTA", modelo, latenciaMs, error: error?.message })`.
  - No alterar el resultado del pipeline.

### 4. Tests
- `src/lib/ai/guardas.test.ts`:
  - Texto RPT-QFUHE8 → `POSIBLE_SPAM` + regla `spam_publicitario_deterministico`.
  - Mock LLM devuelve `OFRECIMIENTO_REGALOS conf 0.67` → hard-rule fuerza `POSIBLE_SPAM`.
  - Texto con 1 hashtag y sin link → NO aplica hard-rule.
- `src/lib/ai/sandbox.test.ts` (o test existente):
  - Modelo timeout → log registrado.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Falsos positivos en hard-rule | Umbral ≥2 señales; dominios configurables |
| Cambiar umbral afecta spam no publicitario | Solo aplica cuando ninguna categoría alcanza severidad ≥75 |
| Log genera ruido | Solo modelo/latencia/error; sin texto de reporte |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Tests unitarios de hard-rule y log.
- No tocar schema ni migraciones.

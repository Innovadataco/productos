# `src/lib/expediente/analisis` — SPEC-341

El motor del **análisis IA capa 2** del expediente (A-68 §4.4). Es reutilizable
por `alcance` para que el módulo del colegio (C3, futuro) monte encima sin
código nuevo de motor.

## Piezas

| Archivo | Qué hace |
|---|---|
| `hash-cadena.ts` | Hash SHA-256 determinista sobre `(ultimoEventoEn, numEventos, categoriasDominantesJson)`. Decide si el análisis vigente sigue sirviendo. |
| `armar-payload.ts` | Dos armadores: `armarPayloadPadre` (hechos completos + cruce con hijo) y `armarPayloadColegio` (SOLO agregados anónimos, cero PII). |
| `prompt.ts` | Resuelve `padre.analisis.prompt_sistema` o `colegio.analisis.prompt_sistema` desde `ParametroSistema`. |
| `validar-salida.ts` | Anti-frases pre-horneadas (FR-014). Cachea la lista 60 s. |
| `ejecutar-analisis.ts` | Orquestador del worker: carga expediente → arma payload → llama Ollama → valida → persiste PUBLICADO o FALLIDO. Serializa `versionSecuencial` con `pg_advisory_xact_lock` por expediente. |

## Uso desde otro módulo (C3 · colegio blindado)

Cuando C3 llegue, la tubería es EXACTAMENTE la misma — solo cambia el `alcance`:

```ts
import { ejecutarAnalisisJob } from "@/lib/expediente/analisis/ejecutar-analisis";
import { sendAnalisisExpediente } from "@/lib/queue";

// Encolar (el worker consume): C3 llama SOLO con alcance distinto.
await sendAnalisisExpediente({
    expedienteId,          // en C3 será un id institucional (patrón, no expediente padre)
    hashCadena,            // C3 usa su propio hash sobre agregados del colegio
    alcance: "COLEGIO_BLINDADO",
    disparador: "APERTURA",
    solicitadoEn: new Date().toISOString(),
});
```

El worker `scripts/worker-analisis-expediente.mjs` NO tiene ramas por
alcance — el orquestador arma el payload correcto según el enum y persiste
con `alcance` en la fila del `AnalisisExpediente`.

## Blindaje del payload de colegio

El armador de colegio NO recibe ni acepta valores de identificador, texto de
reporte, nombre/apellido/documento, edad ni sexo por hecho individual. Está
verificado por test (`armar-payload.test.ts` · "NO contiene ningún
identificador…") con `grep` sobre el JSON del payload. Si alguien agrega un
campo nuevo al armador, el test falla si el campo aparece bajo el `alcance`
de colegio.

## Prohibido

- Nunca enviar texto crudo de reporte al modelo (usa el DAL que ya extrae
  categoría/fecha/ciudad, jamás el `texto` cifrado).
- Nunca hardcodear frases interpretativas en el prompt. El prompt sistema
  vive en `ParametroSistema` y las frases prohibidas también.

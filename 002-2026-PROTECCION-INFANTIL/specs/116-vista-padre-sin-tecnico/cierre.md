# Cierre — Spec 116: Vista del padre sin traza técnica del motor

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA Y COMMITEADA, **SIN PUSH NI DESPLEGAR** (cola nocturna 002-PI-041 bloque B2; el coordinador empuja en serie y ZEUS gatea el release).

## Lo hecho

- **FR-1/FR-2 (UI)**: `MisReporteDetalle.tsx` rehecho. El padre ve SOLO: (1) las
  conductas identificadas —SOLO las confirmadas por el motor, como chips con label
  humano—; (2) "Qué significa esto" — mensaje de plantilla determinista; (3) "Qué puede
  hacer" — `<CanalesOficiales />` (Línea 141 ICBF, CAI Virtual, Te Protejo), visible
  también en estado "en proceso". Eliminadas la tabla categorías×modelos (✓/—, % de
  presencia) y la tarjeta de análisis con umbrales.
- **FR-3 (API)**: contrato de `GET /api/reportes/mis-reportes/[id]` cambiado IN-PLACE
  (decisión documentada en spec.md: endpoint privado del dueño con un único consumidor,
  verificado por grep). Respuesta nueva: `{ reporte, clasificacion: null | { conductas:
  [{ categoria, label }], mensaje } }`. Fuera: `votosModelos`, `porcentajes`, `analisis`,
  `confianza`, scores. Ya no se hace `include` de `rubricaVotos` ni se lee el parámetro
  de umbral.
- **FR-4**: conductas confirmadas = `categoria` + `categoriasSecundarias[].categoria`
  (el motor ya persiste como secundarias SOLO las que superaron el umbral —
  `src/lib/ai/rubrica.ts` L360-383; las descartadas quedan en `ClasificacionRubricaVoto`,
  que este endpoint ya no lee). SPAM/OTRO filtrados (spec 093-US2), dedup defensivo.
- **FR-5**: `construirExplicacionPadre(conductas)` en
  `src/lib/expediente/mensaje-padre.ts` — MISMAS plantillas deterministas del expediente
  (D-23; helpers `plantillasUnicas`/`listarHallazgos` extraídos por refactor puro), sin
  marco de "borrador" (eso es del admin) y sin canales en el texto.
- **FR-6**: nada borrado — la traza completa sigue en el expediente del admin (spec 096,
  endpoint y componente SIN tocar; sus tests verdes). Sin migraciones.

## Pruebas (TDD: tests primero, después la implementación)

- `mensaje-padre.test.ts` (+5): explicación con plantillas, sin borrador/canales, sin
  score/modelos/%, genérica, institucional neutro. Los 6 tests previos del borrador del
  expediente siguen verdes (salida intacta).
- `mis-reportes/[id]/route.test.ts` (8): conductas confirmadas con label; mensaje con
  hallazgo de plantilla; ausencia de `votosModelos`/`porcentajes`/`analisis`/`confianza`/
  scores; barrido del JSON sin nombres de modelos, sin `umbral|voto`, sin la categoría
  DESCARTADA persistida en la traza (`COMPARTIMIENTO_SEXUAL` cumple=false), sin lenguaje
  de riesgo; SPAM/OTRO filtrados; OTRO puro → mensaje neutro; 401/403/404/null intactos.
- `MisReporteDetalle.test.tsx` (7): muestra conductas + "Qué significa esto" + canales;
  NO muestra modelos/%/votos/umbrales/"Evaluación por categoría"; sin conductas →
  neutro + canales visibles; "en proceso" intacto; sin la palabra "riesgo".

## Gate (bajo candado `/tmp/pi-gate-lock`)

- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (0 errores; 1 warning preexistente ajeno en `IaModelSelector.tsx`)
- Tests tocados + colindantes (lista mis-reportes, expediente admin, mensaje-padre):
  **44/44** ✅
- `npm run build` (tras `rm -rf .next`) ✅
- Suite completa `npm run test`: **998/1018** ✅ — 19 fallos en 10 archivos, TODOS
  ajenos a este cambio (trabajo en paralelo a medio hacer de otros agentes: SPEC-110
  resolver de apelaciones, SPEC-118 NavHeader/proxy D-37 en TDD-rojo, deuda
  `min_text_length` en `reportes/route.test.ts`, journeys SPEC-114 que ejercen D-37).
  Verificado: `padre.test.tsx` solo consume la LISTA de mis-reportes (no tocada); el
  expediente admin y la lista siguen verdes en la corrida de 44/44.
  - `src/lib/specs-discipline.test.ts` falla porque `specs/116-…` (y `specs/118-…`) no
    están indexadas en `specs/README.md` — **lo resuelve el coordinador** (regla del
    bloque; ese archivo no se toca).

## Deuda

- Ninguna nueva. La traza técnica histórica sigue en BD y visible solo en el expediente
  del admin (D-22); este cambio cierra la salida hacia el padre, no altera datos.

## Para ZEUS (verificación sugerida)

- `src/app/api/reportes/mis-reportes/[id]/route.ts:79-92` — proyección del contrato
  (conductas confirmadas + mensaje).
- `src/components/modules/MisReporteDetalle.tsx:126-145` — chips solo si hay
  confirmadas; `:150-160` — mensaje + canales.
- Caso límite cubierto por test: reporte con traza de categoría descartada en BD → la
  respuesta no la menciona en ninguna parte.

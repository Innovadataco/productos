# Implementation Plan: Spec 116 — Vista del padre sin traza técnica del motor

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

## Diseño

1. **FR-5 (lib)**: en `src/lib/expediente/mensaje-padre.ts`, extraer los helpers
   `plantillasUnicas` / `listarHallazgos` (sin cambiar la salida de
   `construirMensajePadre`, que usa el expediente admin) y añadir
   `construirExplicacionPadre(conductas: string[]): string` — mismas plantillas
   deterministas, sin marco de borrador ni canales.
2. **FR-3/FR-4 (API)**: reescribir `GET /api/reportes/mis-reportes/[id]/route.ts`:
   - Respuesta nueva: `{ reporte, clasificacion: null | { conductas: [{ categoria, label }], mensaje } }`.
   - Fuera: `votosModelos`, `porcentajes`, `analisis`, `confianza`, `categoriasSecundarias`
     (con score). Ya no se hace `include` de `rubricaVotos` ni se lee
     `ia.rubrica.umbral_presencia` (el motor ya filtró al persistir).
   - `conductas` = principal + secundarias persistidas, sin SPAM/OTRO, dedup;
     `mensaje` = `construirExplicacionPadre(conductas)`.
3. **FR-1/FR-2 (UI)**: reescribir `MisReporteDetalle.tsx`: quitar la tabla
   categorías×modelos y la tarjeta de análisis técnico; mostrar chips de conductas
   confirmadas, tarjeta "Qué significa esto" con el mensaje y `<CanalesOficiales />`
   siempre visible (también en estado "en proceso").
4. **Tests primero (TDD)**: `mensaje-padre.test.ts` (nuevo describe),
   `mis-reportes/[id]/route.test.ts` y `MisReporteDetalle.test.tsx` reescritos al nuevo
   contrato con aserciones negativas (sin modelos/votos/porcentajes/descartadas) y
   positivas (conductas + mensaje + canales).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Otro consumidor del contrato viejo | Grep: el endpoint solo lo consume `MisReporteDetalle.tsx`; e2e no toca el detalle |
| Romper el mensaje del expediente admin | Refactor puro con sus tests (T023) verdes; la salida de `construirMensajePadre` no cambia |
| Secundarias históricas con score < umbral mostradas como confirmadas | El motor solo persiste secundarias ≥ umbral (rubrica.ts L360-383); asunción documentada en spec |
| Borrar traza por accidente | No se toca schema, motor ni endpoint admin; el `include` de votos se omite solo en ESTA lectura |

## Despliegue

**DIFERIDO** (cola nocturna): implementar + commitear, sin deploy ni push; el
coordinador empuja en serie y ZEUS gatea el release.

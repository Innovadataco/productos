# Quickstart — Spec 085: evaluación por error silencioso (ADR_006)

## A. Métricas nuevas en una simulación

1. Lanzar una simulación (1 modelo × el banco de 200: `scripts/simulacion/simulacion-50-casos-eval.json`).
2. Al completar, el detalle del run muestra PRIMERO: **Errores silenciosos**, **ESPS**, **Subestimaciones**; accuracy después.
3. En BD: `metricasJson` incluye `erroresSilenciosos`, `subestimaciones.severidadPerdida`, `esps`, `umbralRevision`.

## B. Comparación multi-modelo

1. Lanzar 2+ modelos (secuencia) sobre el mismo banco.
2. En el comparador, la tabla muestra primero Errores silenciosos / ESPS / Subestimaciones por modelo.
3. Si las runs comparadas mezclan bancos de distinta procedencia → advertencia visible.

## C. Modelo por defecto

```sql
SELECT clave, valor FROM "ParametroSistema" WHERE clave='reportes.classification_model';
-- esperado: gemma2:27b
```
Reversión (documentada en cierre.md): `UPDATE "ParametroSistema" SET valor='ornith:9b' WHERE clave='reportes.classification_model';`

## D. Banco saneado y multi-etiqueta

- Caso #43: `categoriaEsperada = SOLICITUD_MATERIAL` (era CONTACTO_INSISTENTE).
- #45 y #27: con `secundariaEsperada`; el cálculo acepta la secundaria como acierto.
- Auditoría 3+: solo #43 contradicha por 3+ modelos (research.md §R3).

## E. Validar el banco de 200

```bash
npx tsx -e "
const fs=require('fs');
const { parsearArchivoSimulacion } = await import('./src/lib/simulacion/parser.ts');
const r = parsearArchivoSimulacion(fs.readFileSync('scripts/simulacion/simulacion-50-casos-eval.json','utf-8'),'json');
console.log(r.ok ? r.casos.length + ' casos válidos' : r.mensaje);
" --tsconfig tsconfig.json
```

## F. Tests de la spec

```bash
npx vitest run src/lib/simulacion/metricas.test.ts   # ESPS, silenciosos, multi-etiqueta
npx vitest run src/lib/simulacion/                   # suite del módulo
```

# Plan de implementación — SPEC-283 · Migrar los 8 archivos más caros

## Alcance del trabajo

Sustituir `beforeEach(resetDatabase)` por `beforeAll(resetDatabase([...tablas mínimas]))` en los 8 archivos de prueba más caros del BRIEF §4.5. Empezar por los 3 de UNA sola prueba (más rápido, más seguro), continuar por los 5 de múltiples pruebas. Cada archivo va en un commit atómico (`perf(SPEC-283): migrar <archivo> a beforeAll (<antes>s → <después>s)`).

## Orden de trabajo (fijo)

**Grupo A — Trivial, ahorra ~150 s:**
1. `src/lib/dal/repositories/colegio-resumen.test.ts` (1 test)
2. `src/app/api/colegio/carga/confirmar/route.test.ts` (1 test)
3. `src/lib/dal/repositories/embedding.test.ts` (1 test)

**Grupo B — Múltiples pruebas, más aislamiento a validar:**
4. `src/app/api/pagos/aplicar-bono/route.test.ts` (6 tests)
5. `src/app/api/webhooks/resend/route.test.ts` (9 tests)
6. `src/lib/colegio/avisos-observacion.test.ts` (4 tests)
7. `src/app/api/colegio/alertas/route.test.ts` (15 tests)
8. `src/lib/analisis/digest-semanal.test.ts` (40 tests — revisar; probablemente ya está bien porque su costo por prueba es 1,7 s → posible que quede como testigo)

## Procedimiento por archivo

1. **Leer el archivo completo.** Identificar los modelos que se tocan (`prisma.usuario.create`, `prisma.reporte.findMany`, etc.). Anotar la lista de tablas.
2. **Diagnosticar aislamiento**: ¿dos `it` distintos escriben la misma fila `Usuario` con el mismo email? Si sí, contaminación → conservar `beforeEach` y documentar.
3. **Aplicar transformación**:
   ```ts
   // antes
   beforeEach(async () => { await resetDatabase(); });
   // después
   beforeAll(async () => { await resetDatabase(["Usuario", "Colegio", "Reporte"]); });
   ```
4. **Correr el archivo aislado 3 veces**: `npm run test:integration -- <archivo>` × 3. Los 3 resultados idénticos.
5. **Si intermite** → revertir a `beforeEach()` sin argumentos + comentario `// SPEC-283: reset por prueba porque <razón>`.
6. **Commit atómico** con la duración antes/después en el mensaje.

## Determinación de la lista de tablas

Se hace **leyendo el archivo**, no adivinando. Regla mecánica:

- `grep -oE 'prisma\.[a-zA-Z]+\.' <archivo>` → cada modelo Prisma que aparece.
- Mapear `prisma.usuario` → `"Usuario"`, `prisma.reporte` → `"Reporte"`, etc. (nombres CamelCase que aparecen en `pg_tables`).
- Agregar tablas *escritas por dependencia*: si el archivo usa `crearReporte()` que internamente inserta en `ReporteMetadata` y `ReporteConsentimiento`, ambas tablas van a la lista.
- **CASCADE** cubre lo dependiente hacia abajo, pero NO hacia arriba: si el archivo escribe `Reporte` (que apunta a `Usuario`), hay que incluir `Usuario` explícitamente o CASCADE de `Reporte` no borrará el `Usuario` correspondiente.

Cuando dudes, ejecuta el archivo con la lista más chica; si falla por FK, agrega la tabla que falte.

## Triple corrida (SC-009)

Tras el último commit del SPEC-283, en la Mac del dev:

```bash
for i in 1 2 3; do
    echo "=== corrida $i ===" ;
    npm run test:integration 2>&1 | tee /tmp/spec-283-run-$i.txt | tail -5 ;
done ;
diff <(grep -E 'Test Files|Tests ' /tmp/spec-283-run-1.txt) <(grep -E 'Test Files|Tests ' /tmp/spec-283-run-2.txt) && \
diff <(grep -E 'Test Files|Tests ' /tmp/spec-283-run-2.txt) <(grep -E 'Test Files|Tests ' /tmp/spec-283-run-3.txt) && \
echo "TRIPLE CORRIDA OK"
```

**Solo si `TRIPLE CORRIDA OK`** se emite la señal `desarrollo-1: **002-PI-180 · triple corrida OK · 3/3 idénticas · <N> antes → <M> después**`.

Si falla alguna, se identifica el archivo culpable (aparece verde en una corrida y rojo en otra), se REVIERTE ese archivo y se documenta.

## Riesgo y candados

- **Riesgo alto** (candado central del brief): compartir estado entre pruebas puede volverlas frágiles. La triple corrida es el candado principal.
- **SC-005** (no perder pruebas): antes de arrancar se anota `<N total>` de la línea base; al terminar, `<M total>` debe ser ≥ N. Si no, se revierte.
- **SC-006** (cobertura ≥ piso): las duraciones bajan pero los tests siguen ejecutando las mismas líneas → cobertura idéntica esperada. Si el ratchet ya la pincha, se revierte el último archivo migrado.
- **Grupo B en particular**: `alertas/route.test.ts` con 15 pruebas es el más ambicioso. Si intermite, se prueba una variante intermedia: `beforeAll` para el seed común + `beforeEach` que borra solo las 2-3 tablas más volátiles (uso del reset selectivo de SPEC-282 para el mejor de dos mundos).

## Pruebas

- La suite completa `npm run test:integration` × 3 corridas (SC-009).
- Verificación empírica en el propio PR:
  - Comparar duraciones antes/después de cada archivo con SPEC-280.
  - Confirmar que las 4 partes terminan con < 3 min de diferencia (SC-002 de SPEC-281 + SPEC-283).
  - Confirmar que la corrida total baja de ~19 min a ≤ 10 min (SC-001).

## Rollback

Por archivo: revertir su commit atómico. Los otros 7 quedan migrados. Como cada archivo es un commit propio, el rollback quirúrgico es directo.

Si la triple corrida falla y hay > 2 archivos culpables, se revierten los del Grupo B (5..8) y se deja el Grupo A (1..3) que ya ahorra ~150 s con riesgo nulo.

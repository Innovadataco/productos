# SPEC-469 · OLA 4: la Tabla al Sistema de Diseño

> **Lote OLA-1 (PR consolidado SPEC-476).** Este mueble se entrega junto con los otros 11 de la Ola 1 en una sola rama, y **no edita `scripts/tokens-check.ts`**: con SPEC-466 (`<=`) bajar crudos no mueve el piso — el conteo cae bajo el piso (1021) y pasa. Las menciones a «piso X→Y» de abajo son históricas de cuando cada mueble iba a su propio PR.

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §2 · orden de Jelkin (rediseño a tope) · **Autoridad de forma**: Diseño (certifica; nada cierra sin su ✅)

**Impacto en arquitectura:** ninguno. `Tabla` es la primitiva de tabla compartida (6 crudos × 51 pantallas). Cambia la piel, no la conducta (orden/paginación/selección las hacen los consumidores).

---

## Qué se hizo

`src/components/ui/Tabla.tsx`: los 6 crudos `slate` a token `tinta` velado:
- Head «relleno» `bg-slate-100/70 dark:bg-slate-800/60` → `bg-tinta/5`.
- Head «borde» `border-slate-200 dark:border-slate-800` → `border-tinta/10`.
- Body divisor `divide-slate-100 dark:divide-slate-800` → `divide-tinta/10`.

El token de tinta voltea solo en oscuro. Regla dura del catálogo §2: **sin líneas verticales, sin zebra** — la separación es por espacio/tono (`divide-y` horizontal + wash), no por rejilla. La Tabla ya cumplía (nunca tuvo `divide-x` ni `odd/even`); el candado lo fija.

## Candados

- `tokens:check`: piso intacto (1021) (6 crudos menos). Medido sobre `origin/main` fresco (con Button/SPEC-454).
- `tabla-tokens.candado.test.ts` (fuente, sin BD): 0 color crudo; sin `divide-x` (líneas verticales) ni `odd:`/`even:` (zebra); las filas se separan con `divide-y`. Contraprueba por mutación (crudo → rojo; zebra → rojo).
- `Tabla.test.tsx` actualizado a los tokens nuevos (afirmaba `bg-slate-100/70` y `divide-slate-100`); estructura/conducta intactas.

## Certificación (la da DISEÑO)

Diseño certifica la forma; el hover radial suave y las cifras a la derecha (catálogo) son polish de fila/celda, per-consumidor. Circuito: Dev → CEO → Diseño → CEO → Dev.

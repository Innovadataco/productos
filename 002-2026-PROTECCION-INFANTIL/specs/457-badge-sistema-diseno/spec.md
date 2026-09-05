# SPEC-457 · OLA 1: el Badge al Sistema de Diseño (la peor deuda de color)

> **Lote OLA-1 (PR consolidado SPEC-476).** Este mueble se entrega junto con los otros 11 de la Ola 1 en una sola rama, y **no edita `scripts/tokens-check.ts`**: con SPEC-466 (`<=`) bajar crudos no mueve el piso — el conteo cae bajo el piso (1021) y pasa. Las menciones a «piso X→Y» de abajo son históricas de cuando cada mueble iba a su propio PR.

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro de Diseño · catálogo §2 · orden de Jelkin (rediseño a tope) · **Autoridad de forma**: Diseño (certifica; nada cierra sin su ✅)

**Impacto en arquitectura:** ninguno. `Badge` es un mueble compartido (24 usos crudos × 79 pantallas — la peor deuda de color del producto). Cambia la piel, no la conducta.

---

## Qué se hizo

`src/components/ui/Badge.tsx`: las 6 variantes pasan de escala Tailwind cruda a **tokens semánticos por función**:

| variante | antes (crudo) | ahora (token) | función |
|---|---|---|---|
| success | `green-*` | `bg-pino/10 text-pino` | ok / al día / verificado |
| warning | `amber-*` | `bg-ambar/10 text-ambar` | atención |
| danger | `red-*` | `bg-rubi/10 text-rubi` | **criticidad real — nunca rojo decorativo** |
| default | `sky-*` | `bg-cielo/10 text-cielo` | informativo / marca |
| info | `indigo-*` | `bg-cielo/10 text-cielo` | informativo |
| neutral | `slate-*` | `bg-tinta/10 text-muted` | neutro |

Sin `dark:` — los tokens voltean solos por variable CSS. **Conducta intacta:** cada variante muestra el mismo estado que antes, y el estado se lee por texto (children) además del color.

## Candados

- `tokens:check`: piso intacto (1021) (24 crudos menos; el Badge era la peor deuda). Medido sobre `origin/main` fresco (con 455+456).
- `badge-tokens.candado.test.ts` (fuente, sin BD): 0 color crudo en el mueble; cada estado mapea a su token por función (danger=rubi, success=pino, warning=ambar); ningún rojo decorativo. Contraprueba por mutación (crudo de vuelta → rojo; danger≠rubi → rojo).

## Certificación (la da DISEÑO)

Diseño certifica la forma contra prod (o código, vive en pantallas tras login y públicas). Hasta su ✅, el mueble no se marca cerrado en el inventario. Circuito: Dev → CEO → Diseño → CEO → Dev; el Dev no le escribe directo.

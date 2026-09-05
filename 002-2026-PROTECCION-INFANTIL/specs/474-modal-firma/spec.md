# SPEC-474 · OLA 5: cablear la firma en Modal

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §2 grupo B · **Autoridad de forma**: Diseño (falló la ambigüedad del grano y certifica)

**Impacto en arquitectura:** ninguno. Cablea el radio del Modal al token; no cambia conducta.

## Contexto (PARÁ + fallo de Diseño)
Igual que GlassCard, el radicado pedía «+ grano». Se paró (globals:488: grano solo en acento). **Diseño falló:** grano NO (material vidrio), radio = `--radio-hero` (22px). El hallazgo I-320 (3 botones `bg-rubi` sólido fuera del confirmar del modal) **sigue en la mesa de Diseño — NO se toca acá.**

## Qué se hizo
`rounded-2xl` (suelto) → `rounded-[var(--radio-hero)]` en el panel del modal. El material vidrio (`glass-strong` = saturate+blur) ya estaba. **Sin grano.** Conducta/a11y intactas (focus trap, cierre, tamaños). No se tocó ningún `bg-rubi` (I-320 es aparte).

## Candados
- `tokens:check` no se mueve → **floor-safe, fuera de la cadena del piso.**
- `modal-firma.candado.test.ts` (fuente, sin BD): radio por `--radio-hero`, sin radio suelto; material vidrio sin grano. Contraprueba por mutación.

## Certificación
La da **Diseño**. Con este cierra el catálogo de muebles del rediseño.

# SPEC-473 · OLA 5: cablear la firma en GlassCard

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §2 grupo B · **Autoridad de forma**: Diseño (falló la ambigüedad y certifica)

**Impacto en arquitectura:** ninguno. GlassCard es el vidrio base (123 pantallas). Cablea el radio al token; no cambia conducta ni layout.

## Contexto (PARÁ + fallo de Diseño)
El radicado pedía «squircle 32% + grano». Se **paró** por dos contradicciones de fuente: (a) `globals:488` dice que el grano vive SOLO sobre relleno de acento; GlassCard es vidrio neutro; (b) «32%» no mapea a ningún token (`--radio-card` es 16px). **Diseño falló:** grano NO (material saturate+blur), radio = `--radio-card` (16px). Corrigió el sistema/catálogo (fila 76 estaba mal).

## Qué se hizo
`rounded-3xl` (suelto) → `rounded-[var(--radio-card)]` en las dos ramas (interactiva y estática), como ya hacen Accordion y PanelVidrio. **Sin grano.** Conducta/a11y intactas (onClick/teclado/role).

## Candados
- `tokens:check` no se mueve (no había ni se agregó crudo) → **floor-safe, fuera de la cadena del piso.**
- `glasscard-firma.candado.test.ts` (fuente, sin BD): el radio sale de `--radio-card`, sin radio suelto; sin grano. Contraprueba por mutación.

## Certificación
La da **Diseño**. Con Modal (474) cierra el catálogo de muebles.

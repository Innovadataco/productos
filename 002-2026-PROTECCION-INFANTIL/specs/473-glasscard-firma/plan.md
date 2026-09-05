# Plan · SPEC-473
- `GlassCard.tsx`: `rounded-3xl` → `rounded-[var(--radio-card)]` (fallo de Diseño: 16px, no «32%»).
- Sin grano (Diseño: vidrio neutro = material saturate+blur; el grano vive solo en acento).
- Conducta/a11y intactas. NO toca el piso (floor-safe).
- Candado de fuente + contraprueba por mutación. Preflight D-106. Certifica Diseño.

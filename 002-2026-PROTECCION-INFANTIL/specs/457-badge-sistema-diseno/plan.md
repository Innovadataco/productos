# Plan · SPEC-457

- `Badge.tsx`: 6 variantes → tokens semánticos (pino/ambar/rubi/cielo/neutro), sin `dark:`.
- Conducta intacta: mismas variantes, mismo texto; solo cambia el color.
- `tokens:check` piso 1038 → 1014 (medido sobre origin/main con 455+456).
- Candado de fuente + contraprueba por mutación. Preflight D-106.
- Corre en paralelo con Button (454) y Alerta (458) — archivos independientes, cero conflicto entre muebles.
- Certifica Diseño la forma.

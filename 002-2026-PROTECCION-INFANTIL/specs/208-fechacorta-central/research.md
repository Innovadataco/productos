# Research — SPEC-208

## Decisiones ya cerradas por ZEUS / brief

1. **Helper único en `src/lib/format/fecha.ts`**: centraliza formato y timezone.
2. **Timezone `America/Bogota` por defecto**: corrige regresión D-72.
3. **Tres helpers**: `fechaCorta`, `fechaHora`, `fechaISO`.

## Patrones del repo a reutilizar

- Componentes de detalle de usuario en `src/app/dashboard/admin/usuarios/[id]/components/`.
- `Intl.DateTimeFormat` para compatibilidad cliente/servidor.

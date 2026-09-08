# SPEC-601 · Tareas

- [x] T001 · Extraer `registro-hijo/payload.ts` (`construirPayloadAltaHijo`) y hacer que `RegistroHijoWizard` lo use.
- [x] T002 · Crear `FormularioAltaHijo.tsx` recuperado de `git show e74e1a44a^` (formulario inline pre-599, sin documento, alta múltiple de identificadores).
- [x] T003 · Parametrizar `MisHijos` con `varianteAlta?: "wizard" | "formulario"` (default `"wizard"`).
- [x] T004 · `CaminoHijosClient.tsx` pasa `varianteAlta="formulario"`.
- [x] T005 · Test nuevo en `MisHijos.test.tsx`: la variante formulario renderiza el alta inline y registra por POST sin documento.
- [x] T006 · Gate: `tsc --noEmit`, `lint`, `test` (completo), `build`.

# SPEC-601 · Revert acotado: formulario inline en el camino de hijos

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden del dueño (Jelkin): «esta ventana estaba bien, reversa el último cambio» (refiere al Paso 3 del camino del padre tras SPEC-599). Rama `work/pi-SPEC-601-camino-hijos-revert`.

## User story

Como padre en el PASO 3 del onboarding (`/camino/hijos`), quiero el formulario inline simple de siempre (sin wizard), porque en el camino lo que importa es completar rápido; el wizard con círculo de confianza vive en `/dashboard/padre/hijos`, donde fue aprobado.

## Impacto en arquitectura: no

Solo UI. El contrato del POST `/api/padre/hijos` queda intacto (SPEC-589); el constructor del payload se extrae a `registro-hijo/payload.ts` para compartirlo entre las dos variantes.

## Alcance

- `MisHijos` gana la prop `varianteAlta?: "wizard" | "formulario"` (default `"wizard"`: `/dashboard/padre/hijos` no cambia).
- Componente nuevo `FormularioAltaHijo.tsx`: el formulario inline pre-599 (recuperado de `git show e74e1a44a^`), sin documento (SPEC-589), con alta múltiple de identificadores.
- `CaminoHijosClient` pasa `varianteAlta="formulario"`.
- `construirPayloadAltaHijo` extraído y reutilizado por el wizard y el formulario (sin duplicar lógica).

## Functional Requirements

- **FR-001**: El sistema DEBE renderizar el wizard de SPEC-599 en `/dashboard/padre/hijos` (default) y el formulario inline en `/camino/hijos` (`varianteAlta`).
- **FR-002**: El formulario inline DEBE conservar los campos y obligatoriedad de SPEC-589 (nombre/apellidos obligatorios; edad/sexo/cuentas opcionales) y el mismo payload del POST.
- **FR-003**: El sistema NO DEBE duplicar la lógica de construcción del payload entre variantes.

## Criterios de aceptación

- [x] `/camino/hijos` muestra el alta inline sin wizard; `/dashboard/padre/hijos` sigue con el wizard.
- [x] Test nuevo: `varianteAlta="formulario"` renderiza `form-hijo` de entrada y registra por POST sin documento.
- [x] Tests existentes (MisHijos, candado SPEC-555, wizard SPEC-599) en verde sin cambios de aserciones.
- [x] Gate completo verde (tsc, lint, test, build).

## Implementación

- Nuevos: `src/components/modules/padre/FormularioAltaHijo.tsx`, `src/components/modules/padre/registro-hijo/payload.ts`.
- Modificados: `src/components/modules/padre/MisHijos.tsx` (prop `varianteAlta`), `src/components/modules/padre/registro-hijo/RegistroHijoWizard.tsx` (usa el payload compartido), `src/app/camino/hijos/CaminoHijosClient.tsx`, `src/components/modules/padre/MisHijos.test.tsx` (test de la variante).

## Deuda técnica

- Ninguna conocida.

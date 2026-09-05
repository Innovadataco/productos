# SPEC-454 · Plan

## Método

Mueble atómico, certificable solo. La piel vive en `globals.css` (`.btn-ds*`), el componente solo mapea variante→clase. Así el rediseño es una capa CSS revisable de un vistazo por Diseño y el componente queda mínimo.

## Orden de trabajo

1. **Candado de conducta ANTES de tocar la piel** (`Button.test.tsx`, 9 tests contra el Button viejo) — fija el contrato que la re-piel no puede romper.
2. Escalar las decisiones de forma a Diseño (canal Dev→CEO→Diseño→CEO→Dev): mapeo de `secondary`/`danger`, radio único, alcance de la firma. No adivinar.
3. Cablear la piel en `globals.css` + mapear en `Button.tsx` en una sola pasada, con las respuestas en mano.
4. Sumar candados de firma (mapeo + estructura del CSS), verificar por mutación.
5. Bajar el piso de `tokens:check` (la caída es el entregable medible).

## Contrato (del §4 del plan maestro)

- Color solo por token; `tokens:check` baja, nunca sube.
- `prefers-reduced-motion` apaga la órbita.
- Sin cambio de conducta (onClick/disabled/a11y/API).
- Firma solo en el primario; radio 16px.

## Fuera de alcance

- `--accent` por rol en los layouts → SPEC-460.
- Sólido rubí en el «confirmar» del modal → cuando se rediseñe el Modal.
- La excepción `secondary` acción-única → se marca al CEO cuando aparezca, no se resuelve acá.

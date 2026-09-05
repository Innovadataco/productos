# SPEC-475 · Plan

## Método

Corrección de piel de un botón, atómica y certificable sola. Es un **swap de polaridad**: el rubí sólido pasa del disparador (donde no debe estar) al confirmar del modal (la reserva). Se defiende con un candado de conducta que lee la fuente y muere en las dos direcciones de la inversión.

## Orden de trabajo

1. Verificar en fuente la inversión y la regla de la reserva (§7.1 + precedente SPEC-454). No adivinar la forma.
2. Swap en `BotonActivarEmergencia.tsx`: disparador → `<Button variant="danger">`; confirmar → `<button bg-rubi>` (one-off comentado, no variante reusable).
3. Candado que aísla cada botón por su handler y afirma: disparador sin `bg-rubi` + `variant="danger"`; confirmar con `bg-rubi`.
4. Verificar el candado **por mutación** en ambas direcciones (rojo distinto cada una) y restaurar.
5. Preflight completo. **No tocar el piso** (swap net-zero).

## Contrato

- Color solo por token (`bg-rubi`), nunca crudo Tailwind.
- Rubí sólido solo en el confirmar del modal (reserva §7.1); disparador destructivo = Fantasma-rubí.
- Sin cambio de conducta (onClick/fetch/estados/a11y/API).
- `tokens:check` no sube; el piso no se toca (net-zero).

## Fuera de alcance

- Otros botones de I-320 → Diseño caso por caso.
- `CancelarSuscripcion :107/:164` → ya cumplen, no se tocan.
- Cualquier variante reusable de rubí sólido → deliberadamente NO se crea.

/**
 * Nombres de los candados consultivos (pg_advisory_xact_lock) que comparten varios caminos de escritura. Módulo sin
 * dependencias, para que precios, conciliación e importación los tomen sin importarse entre sí.
 * - De conciliar un corte (AAAA-MM-DD): exclusivo en `conciliar` y en la corrección del corte de una certificación;
 *   compartido al guardar un cierre de ese día (src/precios/guardar.ts), para que un cierre no se verifique contra
 *   una certificación que se está retirando (security-reviewer MEDIO, frente certificacion-corte-real).
 * - De los movimientos de un fondo (su codigo_negocio de la SFC): la constitución (src/fondo/movimiento.ts) y los
 *   rendimientos (src/fondo/rendimientos/guardar.ts), para que no se crucen en el mismo fondo. La clave es la de
 *   siempre de la constitución (no cambia: un despliegue a medias sigue serializando con la imagen anterior).
 */
export const candadoConciliar = (dia: string): string => `inv008-conciliar-${dia}`;
export const candadoFondo = (codigoFic: string): string => `008:fondo-movimiento:${codigoFic}`;

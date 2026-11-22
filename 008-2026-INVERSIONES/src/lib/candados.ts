/**
 * Nombres de los candados consultivos (pg_advisory_xact_lock) que comparten varios caminos de escritura. Módulo sin
 * dependencias, para que precios, conciliación e importación los tomen sin importarse entre sí.
 * - De conciliar un corte (AAAA-MM-DD): exclusivo en `conciliar` y en la corrección del corte de una certificación;
 *   compartido al guardar un cierre de ese día (src/precios/guardar.ts), para que un cierre no se verifique contra
 *   una certificación que se está retirando (security-reviewer MEDIO, frente certificacion-corte-real).
 */
export const candadoConciliar = (dia: string): string => `inv008-conciliar-${dia}`;

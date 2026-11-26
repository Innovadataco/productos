/** Las ventanas de /alertas, en días de Colombia (el día de hoy cuenta). Puro: lo usan el servidor y las pruebas. */
export const VENTANA_ALERTAS_DIAS = 30;
export const VENTANA_CONTADOR_DIAS = 7;
/** Tope de filas que se leen de una vez (30 días de las pocas especies de 008 quedan muy por debajo). */
export const TOPE_ALERTAS = 1000;
/** Los ids de la base son cuid (minúsculas y dígitos); el guion se admite para los de las pruebas. */
export const ID_ALERTA = /^[a-z0-9-]{1,64}$/;

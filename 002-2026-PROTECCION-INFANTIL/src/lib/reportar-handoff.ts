/**
 * SPEC-324: traspaso del identificador de /seguimiento a /reportar.
 *
 * El identificador NO puede viajar en la URL (spec 091-US2 / 093-US4: ni href,
 * ni router.push, ni query string — lo vigila `url-privacy.test.ts`). Viaja por
 * `sessionStorage` con esta llave de un solo uso: `SeguimientoClient` la escribe
 * al pulsar "Reportar de nuevo a este identificador" y `ReporteWizard` la lee y
 * la borra al montar. Mismo mecanismo que `seguimiento.rpt`.
 */
export const REPORTAR_STORAGE_KEY = "reportar.identificador";

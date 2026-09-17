/**
 * SPEC-699 (I-424) · UNA SOLA FUENTE para «cuál sobre cifrado tiene el texto de una anotación».
 *
 * AD-3 (opción C): una anotación de ORIGEN REPORTE guarda su relato en el sobre del REPORTE
 * (`reporte.contenidoId`); su propio sobre (`contenidoId`) queda vacío (`texto:""`, creado por
 * `expediente-automatico.ts`). Una anotación sin reporte usa su propio sobre. Cuando el alta
 * es manual, el reporte VINCULADO también lleva el texto, así que leer el sobre del reporte es
 * correcto siempre que `reporteId` exista.
 *
 * Los TRES lectores del texto de un evento —la vista/PDF del padre (`expediente-repository`),
 * el pase externo (`codigo-acceso`) y la línea de tiempo del círculo (`timeline-circulo`)—
 * resuelven el sobre por acá. Antes cada uno decidía por su cuenta y dos descifraban el sobre
 * PROPIO vacío → entregaban el relato en blanco (I-424: la única lectura externa en prod tenía
 * la huella sha-256 de "").
 */
export interface AnotacionConSobres {
    reporteId: string | null;
    contenidoId: string;
    reporte: { contenidoId: string } | null;
}

/** El `contenidoId` cuyo descifrado da el texto real de la anotación. */
export function contenidoIdDeAnotacion(ev: AnotacionConSobres): string {
    return ev.reporteId !== null && ev.reporte ? ev.reporte.contenidoId : ev.contenidoId;
}

// Vistas inventadas de la sección de dividendos decretados de /datos-oficiales (frente datos-oficiales-decretos-pantalla,
// C6b). «Hoy» es el 17-mar-2021, como en ficticio.ts (fuera del periodo de la historia real del dueño). Especies FICT*,
// referencias en rutas «ficticio» y cifras inventadas.
import type { DecretoDelCruceVista, DecretosVista, FilaCruceVista, PagoVista, ProximoVista } from "@/app/datos-oficiales/tipos";

/** hoy − 365: desde aquí se muestra el cruce. */
export const DESDE = "2020-03-17";

export const REF_BVC = "https://www.bvc.com.co/ficticio/c6b-1";
export const REF_SFC = "https://www.superfinanciera.gov.co/ficticio/c6b-p1";

export const proximo = (c: Partial<ProximoVista> = {}): ProximoVista => ({
  clave: "dec-p1", especie: "FICTA", tipo: "ORDINARIO", cuota: 2, valorPorAccion: "41.37", fechaEx: "2021-03-17", fechaPago: "2021-03-24",
  referencia: REF_SFC, version: 2, tenencia: "1237", brutoEstimado: "51174.69", ...c,
});

export const PROXIMOS: readonly ProximoVista[] = [
  proximo(),
  proximo({ clave: "dec-p2", especie: "FICTB", tipo: "EXTRAORDINARIO", cuota: 1, valorPorAccion: "13.7", fechaEx: "2021-03-23", fechaPago: "2021-03-31", referencia: "sfc:FICTICIO-4613", version: 1, tenencia: "97", brutoEstimado: "1328.9" }),
  proximo({ clave: "dec-p3", especie: "FICTI", cuota: 1, valorPorAccion: "23.17", fechaEx: "2021-04-07", fechaPago: "2021-04-14", referencia: "https://www.bvc.com.co/ficticio/c6b-p3", version: 1, tenencia: "-10", brutoEstimado: null }),
];

export const decreto = (c: Partial<DecretoDelCruceVista> = {}): DecretoDelCruceVista => ({
  clave: "dec-1", tipo: "ORDINARIO", cuota: 1, fechaEx: "2021-02-10", valorPorAccion: "4.291731", tenenciaAntesDeLaEx: "1237", bruto: "5308.871247",
  referencia: REF_BVC, version: 1, ...c,
});

const pago = (clave: string, fechaPago: string, montoNeto: string): PagoVista => ({ clave, fechaPago, montoNeto });

export const fila = (c: Partial<FilaCruceVista> = {}): FilaCruceVista => ({
  clave: "dec-1", estado: "RECIBIDO", especie: "FICTA", fechaPago: "2021-02-17", decretos: [decreto()], pagos: [pago("pag-1", "2021-02-19", "4613.27")],
  brutoEsperado: "5308.871247", netoRecibido: "4613.27", diferenciaBrutoNeto: "695.601247", motivos: [], ...c,
});

export const PENDIENTE = fila({
  clave: "dec-2", estado: "PENDIENTE", especie: "FICTB", fechaPago: "2021-03-12",
  decretos: [decreto({ clave: "dec-2", fechaEx: "2021-03-05", valorPorAccion: "23.785", tenenciaAntesDeLaEx: "97", bruto: "2307.145", referencia: "sfc:FICTICIO-4617" })],
  pagos: [], brutoEsperado: "2307.145", netoRecibido: null, diferenciaBrutoNeto: null,
});
export const RECIBIDO = fila();
export const NO_RECIBIDO = fila({
  clave: "dec-3", estado: "NO_RECIBIDO", especie: "FICTB", fechaPago: "2020-12-09",
  decretos: [decreto({ clave: "dec-3", fechaEx: "2020-12-02", valorPorAccion: "17.43", tenenciaAntesDeLaEx: "97", bruto: "1690.71", version: 3 })],
  pagos: [], brutoEsperado: "1690.71", netoRecibido: null, diferenciaBrutoNeto: null,
});
export const SIN_DECRETO = fila({
  clave: "pag-4", estado: "SIN_DECRETO", especie: "FICTC", fechaPago: "2020-11-18", decretos: [], pagos: [pago("pag-4", "2020-11-18", "37.91")],
  brutoEsperado: null, netoRecibido: "37.91", diferenciaBrutoNeto: null,
});
export const EN_DISPUTA = fila({
  clave: "dec-5", estado: "REVISAR", especie: "FICTA", fechaPago: "2020-10-14",
  decretos: [
    decreto({ clave: "dec-5", fechaEx: "2020-10-07", valorPorAccion: "2.613719", bruto: "3233.170403" }),
    decreto({ clave: "dec-6", tipo: "EXTRAORDINARIO", fechaEx: "2020-10-07", valorPorAccion: "0.971313", bruto: "1201.514181", referencia: "sfc:FICTICIO-4711" }),
  ],
  pagos: [pago("pag-5", "2020-10-16", "3917.43")],
  brutoEsperado: "4434.684584", netoRecibido: "3917.43", diferenciaBrutoNeto: "517.254584", motivos: ["PAGO_EN_DISPUTA", "CARGA_NO_CUBRE_LA_EX"],
});
export const TENENCIA_NEGATIVA = fila({
  clave: "dec-7", estado: "REVISAR", especie: "FICTI", fechaPago: "2020-09-09",
  decretos: [decreto({ clave: "dec-7", fechaEx: "2020-09-02", valorPorAccion: "13.71", tenenciaAntesDeLaEx: "-10", bruto: "-137.1" })],
  pagos: [], brutoEsperado: "-137.1", netoRecibido: null, diferenciaBrutoNeto: null, motivos: ["TENENCIA_NEGATIVA"],
});

/** Lo más reciente primero, como lo deja serializar-decretos.ts. */
export const CRUCE: readonly FilaCruceVista[] = [PENDIENTE, RECIBIDO, NO_RECIBIDO, SIN_DECRETO, EN_DISPUTA, TENENCIA_NEGATIVA];

export const DECRETOS: DecretosVista = { desde: DESDE, proximos: PROXIMOS, cruce: CRUCE, sinTenencia: 2 };
export const DECRETOS_VACIOS: DecretosVista = { desde: DESDE, proximos: [], cruce: [], sinTenencia: 0 };

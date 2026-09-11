/**
 * SPEC-438 (I-305) · la franja para quien NO recuerda la hora exacta.
 *
 * El problema que cierra: el formulario dejaba enviar sin hora y el cliente
 * mandaba `new Date()`. El instante del envío quedaba guardado como la hora del
 * hecho — un dato falso, indistinguible de uno verdadero, alimentando la franja
 * horaria que se le entrega al modelo y un informe con valor probatorio.
 *
 * La salida honesta no es rellenar: es dejar que el reportante diga «fue de
 * noche» y **marcar esa hora como aproximada**, para que el análisis pueda
 * distinguirla de una precisa.
 *
 * La hora representativa se calcula en **hora de Bogotá** y en UN solo lugar
 * (lección de I-247 b: la franja se calculó sobre UTC durante meses y la noche
 * entera llegaba al modelo como madrugada). Este módulo es puro y se prueba con
 * tabla de casos.
 */

/** America/Bogota = UTC−5 fijo, sin horario de verano. */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

export const FRANJAS = ["madrugada", "manana", "tarde", "noche"] as const;
export type FranjaAproximada = (typeof FRANJAS)[number];

/**
 * La hora representativa de cada franja, en hora local de Bogotá. Es el CENTRO
 * del bloque, no su borde: decir «de noche» y guardar 18:00 en punto haría que
 * el hecho cayera justo en la frontera con la tarde.
 */
export const HORA_REPRESENTATIVA: Record<FranjaAproximada, number> = {
    madrugada: 3, // 00–06
    manana: 9, //    06–12
    tarde: 15, //    12–18
    noche: 21, //    18–24
};

export const ETIQUETA_FRANJA: Record<FranjaAproximada, string> = {
    madrugada: "Madrugada (12\u00A0a.m. – 6\u00A0a.m.)",
    manana: "Mañana (6\u00A0a.m. – 12\u00A0m.)",
    tarde: "Tarde (12\u00A0m. – 6\u00A0p.m.)",
    noche: "Noche (6\u00A0p.m. – 12\u00A0a.m.)",
};

export function esFranja(valor: string): valor is FranjaAproximada {
    return (FRANJAS as readonly string[]).includes(valor);
}

/**
 * El instante UTC que representa «ese día, esa franja» en Bogotá.
 *
 * @param dia `YYYY-MM-DD` tal como lo eligió el reportante (día local).
 */
export function instanteDeFranja(dia: string, franja: FranjaAproximada): Date {
    const [anio, mes, d] = dia.split("-").map((n) => Number.parseInt(n, 10));
    // Se arma el instante como si la hora local fuera UTC y después se corre el
    // offset: así el resultado cae en la franja de BOGOTÁ, no en la de UTC.
    const comoSiFueraUtc = Date.UTC(anio, mes - 1, d, HORA_REPRESENTATIVA[franja], 0, 0, 0);
    return new Date(comoSiFueraUtc + OFFSET_BOGOTA_MS);
}

/**
 * SPEC-626 (I-379) · INVERSO de la hora representativa: la franja de un instante
 * guardado. Solo es unívoco cuando `horaAproximada = true` (la hora es uno de los
 * cuatro centros). Fuente ÚNICA del mapeo hora→franja, en hora de Bogotá; sirve a
 * la capa de LECTURA para mostrar la franja sin re-derivar el offset en otro lado.
 * Devuelve `null` si la hora no es un centro (dato inesperado: el llamador muestra
 * solo la fecha, nunca una hora de reloj).
 */
export function franjaDeInstante(iso: string | Date): FranjaAproximada | null {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return null;
    const horaBogota = (d.getUTCHours() - 5 + 24) % 24;
    return FRANJAS.find((f) => HORA_REPRESENTATIVA[f] === horaBogota) ?? null;
}

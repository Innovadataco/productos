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
    madrugada: "Madrugada (12 a.m. – 6 a.m.)",
    manana: "Mañana (6 a.m. – 12 m.)",
    tarde: "Tarde (12 m. – 6 p.m.)",
    noche: "Noche (6 p.m. – 12 a.m.)",
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

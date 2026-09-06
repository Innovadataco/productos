/**
 * SPEC-537 · data-viz CON escala. Score de salud del motor: la precisión OBSERVADA del
 * clasificador por categoría. Acá el color CODIFICA el valor (no es chrome) y es criticidad
 * OPERATIVA real, así que el rubí SÍ va en el tramo crítico — distinto del gauge de confianza
 * de un caso (§7.9), que NUNCA usa rojo. Umbrales fijados por Diseño (MAPA-ESCALA-DATAVIZ):
 *
 *   [0,   0.7) → rubí  (crítico: el motor no está confiable)
 *   [0.7, 0.9) → ámbar (atención)
 *   [0.9, 1  ] → pino  (sano)
 *
 * Fuente ÚNICA del mapeo umbral→token: el candado la importa y afirma los cortes y los
 * tokens por tramo (mover 0.7/0.9 o cambiar un token → rojo).
 */
export function precisionColorClass(value: number): string {
    if (value < 0.7) return "bg-rubi/10 text-rubi";
    if (value < 0.9) return "bg-ambar/10 text-ambar";
    return "bg-pino/10 text-pino";
}

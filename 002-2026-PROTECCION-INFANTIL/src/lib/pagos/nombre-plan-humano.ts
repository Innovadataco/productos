/**
 * SPEC-362 (A-70 · G13) — El plan se llama como lo llamaría una persona.
 *
 * En el recorrido de Jelkin la pantalla de planes mostraba "PADRE · MES_6 ·
 * 2026" y "(precio placeholder)": el nombre y la descripción salen de la fila
 * del `Plan` en base de datos, y en producción esas filas quedaron con la clave
 * técnica con que se crearon.
 *
 * Arreglarlo con un UPDATE en producción tapa el síntoma de hoy y deja la
 * puerta abierta para mañana. Acá se decide en la presentación: si el nombre
 * guardado tiene forma de clave interna, la pantalla muestra el nombre derivado
 * de la DURACIÓN — que es dato estructurado y siempre está bien. Si alguien
 * escribió un nombre de verdad, ese manda.
 */
import type { DuracionPlan } from "@prisma/client";

const NOMBRE_POR_DURACION: Record<string, string> = {
    MES_1: "1 mes",
    MES_2: "2 meses",
    MES_3: "3 meses",
    MES_6: "6 meses",
    MES_12: "1 año",
};

const DESCRIPCION_POR_DURACION: Record<string, string> = {
    MES_1: "Un mes de protección para tu familia.",
    MES_2: "Dos meses de protección para tu familia.",
    MES_3: "Tres meses de protección, sin renovar cada mes.",
    MES_6: "Medio año cubierto, con un solo pago.",
    MES_12: "Un año completo, la opción más económica.",
};

/**
 * ¿El texto guardado es una clave interna y no un nombre?
 *
 * Solo dos señales, ambas inequívocas: el código de duración del sistema
 * (`MES_6`) y la palabra "placeholder". La palabra del titular NO cuenta —
 * "Colegio Anual" y "Padre · 3 meses" son nombres legítimos que un
 * administrador escribió, y tratarlos como jerga los borraría de la pantalla.
 * (Ese falso positivo lo cazó el test de SPEC-355 antes de llegar a producción.)
 */
export function pareceClaveTecnica(texto: string | null | undefined): boolean {
    if (!texto) return true;
    return /MES_\d+|placeholder/i.test(texto);
}

/** El nombre que ve la persona. */
export function nombrePlanHumano(plan: {
    nombre: string | null;
    duracion: DuracionPlan | string;
    esFreemium?: boolean;
}): string {
    if (plan.esFreemium) return "Prueba gratis";
    if (!pareceClaveTecnica(plan.nombre)) return plan.nombre as string;
    return NOMBRE_POR_DURACION[plan.duracion] ?? "Plan";
}

/** La descripción que ve la persona. */
export function descripcionPlanHumana(plan: {
    descripcion: string | null;
    duracion: DuracionPlan | string;
    esFreemium?: boolean;
    duracionFreemiumDias?: number;
}): string {
    if (plan.esFreemium) {
        return `Explora la plataforma sin costo durante ${plan.duracionFreemiumDias ?? 30} días.`;
    }
    if (!pareceClaveTecnica(plan.descripcion)) return plan.descripcion as string;
    return DESCRIPCION_POR_DURACION[plan.duracion] ?? "Protección para tu familia.";
}

/**
 * SPEC-136 (E-3): frontera JSON honesta para campos `Json` de Prisma.
 * En lugar de un doble cast vía `unknown` (que miente sobre el contenido),
 * valida DE VERDAD que el valor sea un árbol serializable
 * (primitivas, arrays y objetos planos). `undefined` se acepta y se omite,
 * igual que haría `JSON.stringify` (la propiedad desaparece del documento).
 */
import type { Prisma } from "@prisma/client";

/** Guard: el valor es un árbol JSON serializable (sin funciones, símbolos ni clases). */
export function esJsonValue(valor: unknown): valor is Prisma.InputJsonValue {
    if (valor === null || valor === undefined) return true;
    const tipo = typeof valor;
    if (tipo === "string" || tipo === "number" || tipo === "boolean") return true;
    if (Array.isArray(valor)) return valor.every(esJsonValue);
    if (tipo === "object") return Object.values(valor as Record<string, unknown>).every(esJsonValue);
    return false;
}

/**
 * Convierte a `Prisma.InputJsonValue` validando el contenido. Lanza solo ante un
 * valor no serializable (error de programación), nunca ante datos propios bien formados.
 */
export function aJson(valor: unknown): Prisma.InputJsonValue {
    if (!esJsonValue(valor)) {
        throw new Error("El valor no es serializable a JSON (función, símbolo u objeto no plano)");
    }
    return valor;
}

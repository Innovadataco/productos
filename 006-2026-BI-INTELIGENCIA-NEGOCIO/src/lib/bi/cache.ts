// src/lib/bi/cache.ts · Cache semántico de veredictos HUMANOS (candado 7)
// Producto 006 · BI v2 · Fase 2 · motor NL→SQL
// BICacheSemantico guarda pares pregunta → SQL aprobado por un operador
// HUMANO; la salida del LLM NUNCA entra al cache. La escritura es un flujo
// futuro de aprobación humana; aquí solo se lee.
// Match EXACTO sobre la pregunta normalizada (misma normalización al
// escribir y al buscar): sin embeddings en esta fase — un match difuso
// podría devolver SQL aprobado para otra pregunta.

import { prisma } from "@/lib/db";

/**
 * Normaliza la pregunta para el match exacto: minúsculas, sin tildes
 * (NFD + strip de marcas diacríticas), trim y espacios colapsados.
 * Determinista: la misma pregunta con distinta capitalización o tildes
 * golpea la misma entrada del cache.
 */
export function normalizarPregunta(p: string): string {
    return p
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

/**
 * Busca un veredicto humano para la pregunta YA normalizada. Devuelve el
 * SQL aprobado o null. Match exacto por clave única preguntaNL — solo hay
 * entradas humanas en la tabla (la escritura es el flujo de aprobación).
 */
export async function buscarEnCache(
    preguntaNormalizada: string,
): Promise<{ sqlAprobado: string } | null> {
    if (!preguntaNormalizada) return null;
    const hit = await prisma.bICacheSemantico.findUnique({
        where: { preguntaNL: preguntaNormalizada },
        select: { sqlAprobado: true },
    });
    return hit ? { sqlAprobado: hit.sqlAprobado } : null;
}

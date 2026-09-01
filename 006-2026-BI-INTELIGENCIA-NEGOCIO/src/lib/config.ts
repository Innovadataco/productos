// src/lib/config.ts · Acceso a parámetros de configuración en BD (bi_config)
// Producto 006 · BI v2 · Admin IA
// B3: límites, umbrales, modelos y textos configurables viven en la tabla
// bi_config (editables sin despliegue), NUNCA quemados en el código.
// Patrón de lectura en cada consumidor: parámetro en BD → env → default.

import { prisma } from "@/lib/db";

/**
 * Lee el valor de un parámetro de configuración. Devuelve null si la clave
 * no existe (el llamador decide el fallback: env o default).
 */
export async function getConfig(clave: string): Promise<string | null> {
    const fila = await prisma.bIConfig.findUnique({ where: { clave } });
    return fila?.valor ?? null;
}

/**
 * Crea o actualiza un parámetro. A diferencia del seed (update:{} vacío),
 * setConfig SÍ pisa el valor: es la vía de edición de la página Admin IA.
 * `actualizadoEn` se actualiza solo (@updatedAt).
 */
export async function setConfig(clave: string, valor: string): Promise<void> {
    await prisma.bIConfig.upsert({
        where: { clave },
        create: { clave, valor },
        update: { valor },
    });
}

import { prisma } from "./prisma";
import { decryptParameter, isEncryptedValue } from "./param-encryption";
import type { ParametroSistema, Prisma, PrismaClient } from "@prisma/client";

export type ParametroClient = PrismaClient | Prisma.TransactionClient;

/**
 * Descifra el valor de un parámetro de sistema si está marcado como secreto
 * y el valor tiene el formato cifrado. Si no tiene formato cifrado, devuelve
 * el valor tal cual (compatibilidad con migración gradual).
 */
export function descifrarValorParametro(param: ParametroSistema): ParametroSistema {
    if (!param.esSecreto || !param.valor) return param;
    if (!isEncryptedValue(param.valor)) return param;
    try {
        return { ...param, valor: decryptParameter(param.valor) };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`No se pudo descifrar el parámetro ${param.clave}: ${msg}`);
    }
}

/**
 * Obtiene un parámetro de sistema descifrándolo automáticamente si es secreto.
 * Acepta un cliente de Prisma o un cliente de transacción.
 */
export async function getParametroSistema(
    clave: string,
    client: ParametroClient = prisma
): Promise<ParametroSistema | null> {
    const param = await client.parametroSistema.findUnique({ where: { clave } });
    if (!param) return null;
    return descifrarValorParametro(param);
}

/**
 * Obtiene únicamente el valor de un parámetro, ya descifrado si es secreto.
 */
export async function getParametroSistemaValor(
    clave: string,
    client?: ParametroClient
): Promise<string | null> {
    const param = await getParametroSistema(clave, client);
    return param?.valor ?? null;
}

/**
 * SPEC-726 (decisión Jelkin 24-09) · El tope de tamaño de subida es un PARÁMETRO
 * configurable (`ParametroSistema`), no una constante quemada. Editable desde
 * Configuración del sistema › Parámetros; los cambios se aplican de inmediato
 * ([[ceo-siempre-sembrar-parametrizables]]).
 *
 * DOS claves, dos topes INDEPENDIENTES (Jelkin: la autorización se queda en 5, los
 * documentos suben a 10 — una foto de celular de una tarjeta pasa de 5 MB fácil):
 *   - `documentos.tamano_max_mb`   → default 10, editable.
 *   - `autorizacion.tamano_max_mb` → default 5, editable.
 *
 * UNA SOLA VERDAD: el servidor valida contra este tope (ya NO la constante
 * `AUTORIZACION_TAMANO_MAX_BYTES`) y el cliente lee el MISMO número (para rechazar
 * temprano con el número correcto y dimensionar la barra). Nunca dos topes.
 *
 * VALIDACIÓN (un valor basura no puede tumbar la subida ni volverla infinita): el
 * valor se lee como ENTERO y se ACOTA a [1, 50] MB; si no es un entero válido
 * (vacío, «banana», null) cae al default. `normalizarTopeMb` es pura y testeable.
 *
 * No entra a la cadena de un worker: lee parámetros desde el área de las rutas
 * (misma razón que `padre/tope-hijos.ts`). Import directo, sin barril
 * ([[dev-barril-en-cadena-de-worker-arrastra-alias]]).
 */
import { TipoParametro, CategoriaParametro } from "@prisma/client";
import { getParametroSistemaValor, type ParametroClient } from "@/lib/parametros";

export const TOPE_SUBIDA_MB_MIN = 1;
export const TOPE_SUBIDA_MB_MAX = 50;

export const CLAVE_TOPE_DOCUMENTOS = "documentos.tamano_max_mb";
export const CLAVE_TOPE_AUTORIZACION = "autorizacion.tamano_max_mb";
export const DEFAULT_DOCUMENTOS_MB = 10;
export const DEFAULT_AUTORIZACION_MB = 5;

const BYTES_POR_MB = 1024 * 1024;

function acotar(mb: number): number {
    return Math.min(TOPE_SUBIDA_MB_MAX, Math.max(TOPE_SUBIDA_MB_MIN, mb));
}

/**
 * Convierte el valor CRUDO del parámetro en un tope en MB usable: entero acotado a
 * [MIN, MAX]. Un valor no-entero / vacío / null cae al default (que también se
 * acota). Nunca devuelve algo fuera del rango → la subida jamás queda imposible
 * (0/negativo) ni infinita. Pura: no toca BD.
 */
export function normalizarTopeMb(raw: string | null | undefined, defaultMb: number): number {
    const limpio = raw?.trim() ?? "";
    if (!/^-?\d+$/.test(limpio)) return acotar(defaultMb);
    const n = Number.parseInt(limpio, 10);
    if (!Number.isFinite(n)) return acotar(defaultMb);
    return acotar(n);
}

async function leerTopeMb(clave: string, defaultMb: number, client?: ParametroClient): Promise<number> {
    return normalizarTopeMb(await getParametroSistemaValor(clave, client), defaultMb);
}

/** Tope de documentos del profesional, en MB (validado y acotado). */
export function topeDocumentosMb(client?: ParametroClient): Promise<number> {
    return leerTopeMb(CLAVE_TOPE_DOCUMENTOS, DEFAULT_DOCUMENTOS_MB, client);
}
/** Tope de la autorización firmada, en MB (validado y acotado). */
export function topeAutorizacionMb(client?: ParametroClient): Promise<number> {
    return leerTopeMb(CLAVE_TOPE_AUTORIZACION, DEFAULT_AUTORIZACION_MB, client);
}
/** Tope de documentos en BYTES — lo que el validador de subida compara. */
export async function topeDocumentosBytes(client?: ParametroClient): Promise<number> {
    return (await topeDocumentosMb(client)) * BYTES_POR_MB;
}
/** Tope de la autorización en BYTES. */
export async function topeAutorizacionBytes(client?: ParametroClient): Promise<number> {
    return (await topeAutorizacionMb(client)) * BYTES_POR_MB;
}

/**
 * Siembra idempotente de los dos topes. `update: {}` a propósito: si el admin ya
 * editó el valor desde la config, un redeploy NO lo pisa (contrato del seed en
 * `deploy-prod.sh`: respeta el valor custom). Solo crea el que falte, con su
 * default. Se llama desde `prisma/seed.ts`.
 */
export async function sembrarTopesSubida(client: ParametroClient): Promise<void> {
    const filas = [
        {
            clave: CLAVE_TOPE_DOCUMENTOS,
            valor: String(DEFAULT_DOCUMENTOS_MB),
            descripcion: `Tamaño máximo (MB) de un documento del profesional. Entero ${TOPE_SUBIDA_MB_MIN}–${TOPE_SUBIDA_MB_MAX} MB; un valor fuera de rango se acota. SPEC-726.`,
        },
        {
            clave: CLAVE_TOPE_AUTORIZACION,
            valor: String(DEFAULT_AUTORIZACION_MB),
            descripcion: `Tamaño máximo (MB) de la autorización firmada del profesional. Entero ${TOPE_SUBIDA_MB_MIN}–${TOPE_SUBIDA_MB_MAX} MB; un valor fuera de rango se acota. SPEC-726.`,
        },
    ];
    for (const f of filas) {
        await client.parametroSistema.upsert({
            where: { clave: f.clave },
            update: {}, // respeta el valor editado por el admin; no lo pisa en redeploy
            create: {
                clave: f.clave,
                valor: f.valor,
                tipo: TipoParametro.INTEGER,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                descripcion: f.descripcion,
            },
        });
    }
}

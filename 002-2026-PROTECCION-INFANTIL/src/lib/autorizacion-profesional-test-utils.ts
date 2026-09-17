/**
 * Utilidades de test para la AUTORIZACIÓN del profesional aceptada en pantalla (SPEC-686/703).
 *
 * `resetDatabase()` trunca los parámetros, así que cada test que ejercita la completitud o la
 * guardia debe sembrar la versión vigente (y, si va a llamar al route real `/aceptar`, la ruta
 * del documento). Espejo del `seedAutorizacionProfesional()` de `prisma/seed.ts`.
 */
import { TipoParametro, CategoriaParametro } from "@prisma/client";
import { prisma } from "./prisma";

export const VERSION_AUTORIZACION_TEST = "v0.1";

const PARAMS: Array<{ clave: string; valor: string }> = [
    { clave: "autorizacion_profesional.version_actual", valor: VERSION_AUTORIZACION_TEST },
    { clave: "autorizacion_profesional.documento_ruta", valor: "public/legal/AUTORIZACION-PROFESIONAL-v0.1.md" },
    { clave: "autorizacion_profesional.version_tipo", valor: "FONDO" },
];

/** Siembra los parámetros de la autorización (versión vigente + ruta del texto + tipo). */
export async function crearParametrosAutorizacionProfesional(): Promise<void> {
    for (const p of PARAMS) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor, tipo: TipoParametro.STRING, categoria: CategoriaParametro.LEGAL },
            create: {
                clave: p.clave,
                valor: p.valor,
                tipo: TipoParametro.STRING,
                categoria: CategoriaParametro.LEGAL,
                esPublico: false,
                descripcion: `${p.clave} (test)`,
            },
        });
    }
}

/**
 * Registra una aceptación de la versión vigente para `usuarioId` (y siembra los parámetros).
 * Es lo que necesita `perfilCompletoParaRevision` para ver la autorización aceptada.
 */
export async function sembrarAceptacionAutorizacion(usuarioId: string, version = VERSION_AUTORIZACION_TEST) {
    await crearParametrosAutorizacionProfesional();
    return prisma.aceptacionAutorizacionProfesional.create({
        data: { usuarioId, version, documentoHash: "h-test", ip: "1.1.1.1", aceptadoEn: new Date() },
    });
}

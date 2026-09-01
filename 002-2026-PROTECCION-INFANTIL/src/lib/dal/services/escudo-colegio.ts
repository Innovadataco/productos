/**
 * SPEC-351 (A-69 · D1) — DAL del escudo institucional. Separado de
 * informes-caso.ts a propósito: aquel es INMUTABLE por contrato (su test
 * rechaza cualquier export mutador) y el escudo sí se actualiza.
 */
import { prisma } from "../../prisma";

/** El colegioId del rector — null si el usuario no es admin de un colegio. */
export async function colegioDelRector(usuarioId: string): Promise<string | null> {
    const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { colegioId: true } });
    return u?.colegioId ?? null;
}

export async function actualizarEscudoColegio(colegioId: string, assetKey: string): Promise<void> {
    await prisma.colegio.update({ where: { id: colegioId }, data: { escudoAssetKey: assetKey } });
}

export async function escudoAssetKeyDeColegio(colegioId: string): Promise<string | null> {
    const c = await prisma.colegio.findUnique({ where: { id: colegioId }, select: { escudoAssetKey: true } });
    return c?.escudoAssetKey ?? null;
}

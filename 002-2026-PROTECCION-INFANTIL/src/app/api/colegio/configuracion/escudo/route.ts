/**
 * SPEC-351 (A-69 · D1 · T060) · POST/GET /api/colegio/configuracion/escudo.
 * SOLO PNG/JPG por magia de bytes (SVG prohibido — candado CEO), ≤ 500 KB.
 * Q-3: prisma solo en el DAL (escudo-colegio.ts).
 */
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { guardarEscudo, rutaEscudo } from "@/lib/colegio/escudo-storage";
import { colegioDelRector, actualizarEscudoColegio, escudoAssetKeyDeColegio } from "@/lib/dal/services/escudo-colegio";

async function guardRectorConColegio() {
    const user = await verifyAuth();
    if (user.rol !== "SCHOOL_ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    const colegioId = await colegioDelRector(user.id);
    if (!colegioId) {
        throw new AppError("Colegio no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    return { user, colegioId };
}

export async function POST(request: Request) {
    try {
        const { colegioId } = await guardRectorConColegio();

        const form = await request.formData().catch(() => null);
        const archivo = form?.get("escudo");
        if (!archivo || typeof archivo === "string") {
            return NextResponse.json(
                { error: { message: "Adjunte el archivo del escudo (campo 'escudo')", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await archivo.arrayBuffer());
        let assetKey: string;
        try {
            ({ assetKey } = await guardarEscudo(colegioId, buffer));
        } catch (err) {
            return NextResponse.json(
                { error: { message: err instanceof Error ? err.message : "Escudo inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        await actualizarEscudoColegio(colegioId, assetKey);
        return NextResponse.json({ assetKey }, { status: 200 });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[ESCUDO·POST] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const { colegioId } = await guardRectorConColegio();
        const assetKey = await escudoAssetKeyDeColegio(colegioId);
        if (!assetKey) {
            return NextResponse.json(
                { error: { message: "El colegio no tiene escudo cargado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        const buffer = await readFile(rutaEscudo(assetKey)).catch(() => null);
        if (!buffer) {
            return NextResponse.json(
                { error: { message: "El escudo no está disponible", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        const mime = assetKey.endsWith(".png") ? "image/png" : "image/jpeg";
        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: { "Content-Type": mime, "Cache-Control": "no-store" },
        });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[ESCUDO·GET] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

/**
 * SPEC-340 (A-68 §3.3-bis) — GET /api/padre/reportes/[id]/texto.
 *
 * LA ÚNICA VÍA por la que el texto propio viaja al navegador. El listado jamás
 * lo incluye (tapar con CSS un texto ya presente en el DOM sería teatro de
 * seguridad — research R-4). La AUTORIDAD es de este servidor:
 *   - sesión joven (< M minutos desde el login, iat del JWT) → entrega,
 *   - o sello de step-up fresco (contraseña revalidada)     → entrega,
 *   - si no → 403 STEP_UP_REQUERIDO y el cliente pide la contraseña.
 *
 * El PDF queda EXENTO por diseño: es el entregable deliberado (brief §3.3-bis).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuth, verifyToken } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireEnv } from "@/lib/env";
import { getParametroSistemaValor } from "@/lib/parametros";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { textoCifradoDeReportePropio } from "@/lib/dal/services/expediente-vivo";
import { leerSelloStepUp, NOMBRE_COOKIE_STEPUP } from "@/lib/routing/stepup-sello";

const HOST_COOKIE = "__Host-token";
const LEGACY_COOKIE = "token";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;

        const minutos = parseInt((await getParametroSistemaValor("padre.texto.stepup_minutos")) ?? "30", 10);
        const umbralSeg = (Number.isFinite(minutos) && minutos > 0 ? minutos : 30) * 60;

        // Edad de sesión: el iat del JWT (se firma en login).
        const cookieStore = await cookies();
        const jwt = cookieStore.get(HOST_COOKIE)?.value ?? cookieStore.get(LEGACY_COOKIE)?.value;
        const payload = jwt ? await verifyToken(jwt) : null;
        const iat = typeof payload?.iat === "number" ? payload.iat : 0;
        const edadSeg = Math.floor(Date.now() / 1000) - iat;

        const sesionJoven = edadSeg >= 0 && edadSeg < umbralSeg;
        const sello = leerSelloStepUp(
            cookieStore.get(NOMBRE_COOKIE_STEPUP)?.value,
            usuario.id,
            requireEnv("JWT_SECRET", 32),
            umbralSeg
        );

        if (!sesionJoven && !sello) {
            return NextResponse.json(
                {
                    error: {
                        message: "Por tu seguridad, confirma tu contraseña para ver este texto.",
                        code: "STEP_UP_REQUERIDO",
                    },
                },
                { status: 403 }
            );
        }

        // El reporte PROPIO (PII: dueño único). El texto ajeno no existe acá.
        // La consulta vive en el DAL (Q-3); acá solo la autoridad y el descifrado.
        const textoCifrado = await textoCifradoDeReportePropio(usuario.id, id);
        if (textoCifrado === null) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({ texto: descifrarTextoReporte(textoCifrado) });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[TEXTO] Error entregando texto propio:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { bloquearIpBodySchema } from "@/lib/schemas";
import { bloquearIp } from "@/lib/anti-abuso/block-list";

function hashIp(ip: string): string {
    return createHash("sha256").update(ip.trim().toLowerCase()).digest("hex");
}

export async function POST(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "anti_abuso");
        if (String(user.rol) !== "ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await req.json();
        const parsed = bloquearIpBodySchema.safeParse(body);
        if (!parsed.success) {
            const detalle = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
            return NextResponse.json(
                { error: { message: `Parámetros inválidos — ${detalle}`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const ipHash = hashIp(parsed.data.ip);
        const bloqueo = await bloquearIp({
            ipHash,
            ipOriginal: parsed.data.ip,
            motivo: parsed.data.motivo,
            duracion: parsed.data.duracion,
            creadoPorId: user.id,
            request: req,
        });

        return NextResponse.json({ ok: true, bloqueo });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

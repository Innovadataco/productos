import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esOperadorRol } from "@/lib/operadores/permisos";
import { generarSugerenciasBanco } from "@/lib/spam/analitica";

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "revision_spam");
        if (!esAdminRol(user.rol) && !esOperadorRol(user.rol)) {
            return new Response(
                JSON.stringify({ error: { message: "Requiere rol OPERADOR o ADMIN", code: ERROR_CODES.FORBIDDEN } }),
                { status: 403, headers: { "Content-Type": "application/json" } }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return new Response(
                JSON.stringify({ error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } }),
                { status: 429, headers: { "Content-Type": "application/json", ...rate.headers } }
            );
        }

        const url = new URL(req.url);
        const limitParam = url.searchParams.get("limit");
        const limit = Math.min(1000, Math.max(1, Number(limitParam) || 100));

        const sugerencias = await generarSugerenciasBanco(limit);
        const lines = sugerencias.map((s) => JSON.stringify(s)).join("\n");

        return new Response(lines + (lines ? "\n" : ""), {
            status: 200,
            headers: {
                "Content-Type": "application/jsonlines",
                "Content-Disposition": `attachment; filename="banco-spam-sugerido-${new Date().toISOString().slice(0, 10)}.jsonl"`,
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return new Response(JSON.stringify(error.toJSON()), { status: error.statusCode, headers: { "Content-Type": "application/json" } });
        }
        return new Response(
            JSON.stringify({ error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

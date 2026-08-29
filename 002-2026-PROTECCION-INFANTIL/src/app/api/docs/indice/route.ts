import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";
import { temasVisibles } from "@/lib/docs/indice";

/**
 * GET /api/docs/indice — índice del módulo de documentación (SPEC-017) en JSON,
 * filtrado por el acceso del llamante: anónimo = capa 1; autenticado = +capa 2;
 * ADMIN/SCHOOL_ADMIN = +capa 3. Sesión opcional (divulgación progresiva, como
 * /api/consulta): el token se lee del header cookie.
 */
export async function GET(request: Request) {
    try {
        const cookieHeader = request.headers.get("cookie") ?? "";
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)(?:__Host-token|token)=([^;]+)/);
        const payload = tokenMatch ? await verifyToken(tokenMatch[1]) : null;

        const temas = temasVisibles(payload?.rol as string | undefined).map((t) => ({
            slug: t.slug,
            titulo: t.titulo,
            descripcion: t.descripcion,
            capa: t.capa,
            documentos: t.documentos,
        }));

        return NextResponse.json({ autenticado: !!payload, temas });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

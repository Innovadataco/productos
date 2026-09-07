import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { spamPendientesQuerySchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol, esOperadorRol } from "@/lib/operadores/permisos";
import { descifrarCamposReporte } from "@/lib/dal/services/descifrar-contenido";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { getParametroSistema } from "@/lib/parametros";
import { derivarMotivoIngreso } from "@/lib/spam/motivo-ingreso";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "revision_spam");
        if (!esAdminRol(user.rol) && !esOperadorRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Requiere rol OPERADOR, COMITE_VALIDACION o ADMIN", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(req.url);
        const parsedQuery = spamPendientesQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, q, estado, orden, asignadoAMi } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        // Cola de spam: POSIBLE_SPAM, o REVISION_MANUAL clasificado como SPAM.
        // El filtro `estado` acota a una sola de esas dos ramas (SPEC-181).
        const condiciones: Prisma.ReporteWhereInput[] = [
            estado === "POSIBLE_SPAM"
                ? { estado: "POSIBLE_SPAM" }
                : estado === "REVISION_MANUAL"
                    ? { estado: "REVISION_MANUAL", clasificacion: { categoria: "SPAM" } }
                    : {
                        OR: [
                            { estado: "POSIBLE_SPAM" },
                            { estado: "REVISION_MANUAL", clasificacion: { categoria: "SPAM" } },
                        ],
                    },
        ];
        if (q) {
            // Mismo criterio de búsqueda que la bandeja principal (reportes-revision).
            condiciones.push({
                OR: [
                    { numeroSeguimiento: { contains: q, mode: "insensitive" } },
                    { identificador: { contains: q, mode: "insensitive" } },
                ],
            });
        }

        const where: Prisma.ReporteWhereInput = whereReporteVigente({ AND: condiciones });

        if (asignadoAMi || user.rol === "OPERADOR") {
            where.operadorId = user.id;
        }

        // Parámetros para derivar el motivo de ingreso real de cada POSIBLE_SPAM.
        const [umbralSpamRaw, umbralDominanciaRaw, dominiosRaw, [reportes, total]] = await Promise.all([
            getParametroSistema("clasificacion.umbral_spam"),
            getParametroSistema("spam.dominancia_umbral"),
            getParametroSistema("spam.dominios_acortadores"),
            // E-8: las lecturas viven en los repos; la ruta no toca prisma.
            new ReporteRepository().findBandejaSpam(where, { skip, take: pageSize }, orden),
        ]);

        const umbralSpam = parseFloat(umbralSpamRaw?.valor ?? "0.7");
        const umbralDominancia = parseFloat(umbralDominanciaRaw?.valor ?? "0.33");
        const dominiosAcortadores: string[] = (() => {
            try {
                return dominiosRaw?.valor ? (JSON.parse(dominiosRaw.valor) as string[]) : [];
            } catch {
                return [];
            }
        })();

        // S-C: descifrado en LOTE (2 queries) del texto de cada reporte de la bandeja.
        const textos = await descifrarCamposReporte(reportes.map((r) => r.contenidoId), "texto");
        return NextResponse.json({
            reportes: reportes.map((r) => {
                const texto = textos.get(r.contenidoId)!;
                const secundarias = (r.clasificacion?.categoriasSecundarias as { categoria: string; score: number }[] | null) ?? null;
                // SPEC-130 (BL-4, O-2): texto descifrado solo en este camino autorizado.
                // SPEC-520 + S-C: se descifra UNA vez (en lote, S-C) y alimenta TANTO el
                // motivo COMO la vista — el motivo se deriva sobre el PLANO (antes miraba
                // el ciphertext desde que existe el cifrado, BL-4).
                const { motivo, confianzaSpam } = derivarMotivoIngreso({
                    categoria: r.clasificacion?.categoria ?? null,
                    confianza: r.clasificacion?.confianza ?? null,
                    categoriasSecundarias: secundarias,
                    texto,
                    umbralSpam,
                    umbralDominancia,
                    dominiosAcortadores,
                });
                return {
                    ...r,
                    texto,
                    motivoIngreso: motivo,
                    confianzaSpam,
                    asignadoA: r.operador ?? null,
                };
            }),
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
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

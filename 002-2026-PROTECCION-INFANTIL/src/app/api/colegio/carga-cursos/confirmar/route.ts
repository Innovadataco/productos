/**
 * SPEC-379 (PR B · D5a) — POST /api/colegio/carga-cursos/confirmar.
 *
 * Consume el token firmado del `/validar` (single-use, 15 min), materializa
 * los cursos dentro de una `withUnitOfWork`. Idempotente frente a carreras:
 * un curso duplicado por race entre validar y confirmar viola la restricción
 * `@@unique([colegioId, nombre, grado, anioLectivo])` (P2002) → se omite con
 * un contador aparte.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarTokenCarga } from "@/lib/colegio/carga/token";
import { CargaRosterSesionRepository } from "@/lib/dal/repositories/carga-roster-sesion";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";

const bodySchema = z.object({ token: z.string().min(10) });

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Este rector no tiene colegio asociado.", code: ERROR_CODES.CONFLICT } },
                { status: 409 },
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }

        const body = await request.json().catch(() => undefined);
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Falta el token.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 },
            );
        }

        const payload = await verificarTokenCarga(parsed.data.token);
        if (!payload) {
            return NextResponse.json(
                { error: { message: "El token venció o no es válido. Vuelva a validar el archivo.", code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 410 },
            );
        }
        if (payload.colegioId !== user.colegioId) {
            return NextResponse.json(
                { error: { message: "Token de otro colegio.", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 },
            );
        }

        const sesion = await new CargaRosterSesionRepository().obtenerValidaCursos(
            payload.sesionId,
            user.colegioId,
        );
        if (!sesion) {
            return NextResponse.json(
                { error: { message: "La validación venció. Vuelva a validar el archivo.", code: ERROR_CODES.NOT_FOUND } },
                { status: 410 },
            );
        }

        const cursos = sesion.filas;

        const { creados, duplicadosRace } = await withUnitOfWork(async (tx) => {
            let creadosCount = 0;
            let duplicadosCount = 0;
            const repo = new CursoRepository(tx);
            for (const c of cursos) {
                try {
                    await repo.crear(user.colegioId!, {
                        nombre: c.nombre,
                        grado: c.grado,
                        anioLectivo: c.anioLectivo,
                        profesorTitularId: c.profesorTitularId,
                    });
                    creadosCount++;
                } catch (err) {
                    const e = err as { code?: unknown };
                    if (typeof e === "object" && e !== null && e.code === "P2002") {
                        duplicadosCount++;
                        continue;
                    }
                    throw err;
                }
            }
            await new CargaRosterSesionRepository(tx).consumir(user.colegioId!, payload.sesionId);
            return { creados: creadosCount, duplicadosRace: duplicadosCount };
        });

        const res = NextResponse.json({ ok: true, creados, duplicadosRace }, { status: 201 });
        // Igual que `carga-profesores/confirmar`: por si es el primer curso
        // activo que cierra el Paso 4 del camino guiado — sella al instante.
        await sellarCookieSesionEstado(res, user.id);
        return res;
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CARGA-CURSOS/CONFIRMAR]");
    }
}

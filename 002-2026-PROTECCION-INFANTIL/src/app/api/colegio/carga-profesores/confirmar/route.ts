/**
 * SPEC-344 (A-69 · C1) — POST /api/colegio/carga-profesores/confirmar.
 *
 * Consume el token firmado del `/validar` (single-use, 15 min), materializa
 * los profesores dentro de una `withUnitOfWork`, y sella la cookie de estado
 * para que el Paso 3 del camino cierre al instante.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarTokenCarga } from "@/lib/colegio/carga/token";
import { consumirSesionRoster } from "@/lib/colegio/carga/sesion-roster";
import { CargaRosterSesionRepository } from "@/lib/dal/repositories/carga-roster-sesion";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import type { ProfesorNormalizado } from "@/lib/colegio/carga-profesores/validator";

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

        // SPEC-344: el roster de profesores tiene su propio shape — se lee con
        // la variante `obtenerValidaProfesores` (el de alumnos validaría el
        // shape equivocado y rechazaría el roster; bug cazado en recorrido).
        const sesion = await new CargaRosterSesionRepository().obtenerValidaProfesores(
            payload.sesionId,
            user.colegioId,
        );
        if (!sesion) {
            return NextResponse.json(
                { error: { message: "La validación venció. Vuelva a validar el archivo.", code: ERROR_CODES.NOT_FOUND } },
                { status: 410 },
            );
        }

        const profesores: ProfesorNormalizado[] = sesion.filas;

        const { creados, duplicadosRace } = await withUnitOfWork(async (tx) => {
            let creadosCount = 0;
            let duplicadosCount = 0;
            const repo = new ProfesorRepository(tx);
            for (const p of profesores) {
                try {
                    await repo.crear(user.colegioId!, {
                        nombre: p.nombre,
                        apellidos: p.apellidos,
                        tipoDocumento: p.tipoDocumento,
                        numeroDocumento: p.numeroDocumento,
                        anioNacimiento: p.anioNacimiento,
                        sexo: p.sexo,
                        email: p.email,
                        telefono: p.telefono,
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
            await consumirSesionRoster(payload.sesionId, tx);
            return { creados: creadosCount, duplicadosRace: duplicadosCount };
        });

        const res = NextResponse.json({ ok: true, creados, duplicadosRace }, { status: 201 });
        await sellarCookieSesionEstado(res, user.id);
        return res;
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CARGA-PROFESORES/CONFIRMAR]");
    }
}

/**
 * SPEC-340 (A-68 §4) — POST /api/padre/expedientes.
 *
 * SPEC-604 (modelo EXPEDIENTE · cimientos): el expediente nace SOLO en el alta
 * del primer reporte (ver `expediente-automatico.ts`) y el botón «Crear
 * expediente» desapareció de Mis reportes. Este endpoint queda como vía de
 * BACKFILL para cadenas legadas anteriores a SPEC-604 (sin expediente): la
 * llamada crea el expediente desde la cadena, igual que antes, y su
 * idempotencia (padre+identificador, cualquier estado) lo hace seguro a dobles
 * toques y a cruces con el alta automática (devuelve el existente).
 *
 * Idempotente: la cadena con expediente devuelve el existente (dos toques no
 * crean dos). Los eventos del expediente se arman DESDE la cadena
 * (Reporte.reportePrincipalId) — de ahí en adelante, todo el mundo lector del
 * expediente (compilación, timeline, PDF) funciona igual que siempre.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";

const bodySchema = z.object({
    reportePrincipalId: z.string().min(1),
});

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resultado = await withUnitOfWork(async (tx) => {
            // El principal debe ser del padre (PII: acceso solo del dueño). Si le
            // pasaron el id de un evento, se resuelve a su principal.
            const reporte = await tx.reporte.findFirst({
                where: { id: parsed.data.reportePrincipalId, usuarioId: usuario.id },
                select: { id: true, identificador: true, plataformaId: true, creadoEn: true, reportePrincipalId: true },
            });
            if (!reporte) return { tipo: "no_encontrado" as const };

            const principalId = reporte.reportePrincipalId ?? reporte.id;
            const principal =
                principalId === reporte.id
                    ? reporte
                    : await tx.reporte.findFirstOrThrow({
                        where: { id: principalId, usuarioId: usuario.id },
                        select: { id: true, identificador: true, plataformaId: true, creadoEn: true, reportePrincipalId: true },
                    });

            const expRepo = new ExpedienteRepository(tx);

            // Idempotencia: la cadena (padre+identificador) con expediente EN
            // CUALQUIER estado devuelve el existente. Con buscarExpedienteActivo
            // (solo ACTIVO) un expediente en CONSOLIDANDO/PENDIENTE_COMITE
            // duplicaría al segundo toque — y con el auto-cierre derogado esos
            // estados no vuelven solos a ACTIVO (hallazgo del verificador).
            const existente = await tx.expediente.findFirst({
                where: { padreUsuarioId: usuario.id, identificadorReportado: principal.identificador },
                orderBy: { fechaApertura: "desc" },
            });
            if (existente) return { tipo: "existente" as const, expediente: existente };

            const expediente = await expRepo.crearExpediente({
                padreUsuarioId: usuario.id,
                identificadorReportado: principal.identificador,
                plataformaId: principal.plataformaId ?? undefined,
            });
            // SPEC-340: nace por el botón — el origen queda en la ficha.
            await tx.expediente.update({
                where: { id: expediente.id },
                data: { origenCreacion: "PADRE" },
            });

            // Los eventos se arman DESDE la cadena: el principal + sus eventos,
            // en orden cronológico. texto="" (AD-3 opción C: se descifra al leer).
            const cadena = await tx.reporte.findMany({
                where: {
                    OR: [{ id: principal.id }, { reportePrincipalId: principal.id }],
                },
                orderBy: { creadoEn: "asc" },
                select: { id: true, creadoEn: true },
            });
            for (const r of cadena) {
                await expRepo.agregarEvento({
                    expedienteId: expediente.id,
                    texto: "",
                    reporteId: r.id,
                    fechaEvento: r.creadoEn,
                });
            }
            return { tipo: "creado" as const, expediente };
        });

        if (resultado.tipo === "no_encontrado") {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { expedienteId: resultado.expediente.id, creado: resultado.tipo === "creado" },
            { status: resultado.tipo === "creado" ? 201 : 200 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[EXPEDIENTES] Error creando expediente por botón:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

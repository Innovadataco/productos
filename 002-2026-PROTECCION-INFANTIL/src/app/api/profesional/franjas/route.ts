/**
 * SPEC-395 (L4) · Franjas del profesional.
 * GET  — lista las franjas del profesional autenticado (futuras).
 * POST — crea una franja disponible.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { AppError, ERROR_CODES } from "@/lib/errors";

const crearSchema = z.object({
    inicio: z.string().datetime(),
    fin: z.string().datetime(),
    modalidad: z.enum(["VIRTUAL", "PRESENCIAL"]),
});

export async function GET() {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const franjas = await new FranjaDisponibleRepository().listarDeProfesional(perfil.id);
        return NextResponse.json({ data: franjas });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/FRANJAS/GET]");
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const body = crearSchema.parse(await request.json());
        const inicio = new Date(body.inicio);
        const fin = new Date(body.fin);
        if (fin.getTime() <= inicio.getTime()) {
            throw new AppError("El fin debe ser posterior al inicio", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        // SPEC-447 (I-311): dos validaciones que la ruta no tenía y que la
        // pantalla nueva vuelve alcanzables por primera vez de verdad.
        //
        // 1) Modalidad que el profesional NO atiende. Publicarla es prometerle
        //    a una familia algo que no va a poder cumplir; el directorio del
        //    padre filtra por estos mismos dos campos.
        if (body.modalidad === "VIRTUAL" && !perfil.atiendeVirtual) {
            throw new AppError("No atiende de forma virtual", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (body.modalidad === "PRESENCIAL" && !perfil.atiendePresencial) {
            throw new AppError("No atiende de forma presencial", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        // 3) SPEC-449 (I-313) · TOPE DE HORIZONTE. La Ley 2375/2024 mide la
        //    obligación en el momento de la ATENCIÓN, no en el de la reserva:
        //    una franja que termina después de que caduquen los antecedentes es
        //    una cita agendada para cuando ya no valen.
        //
        //    Este tope es lo que DISUELVE el dilema del punto 4 de SPEC-449 —
        //    qué hacer con las citas confirmadas de un profesional que vence—:
        //    con él, ninguna cita nueva puede caer del otro lado del
        //    vencimiento, así que el caso deja de ser alcanzable por la vía
        //    normal. Prevenir en vez de cortar.
        const venceEn = await new PerfilProfesionalRepository().venceEnVigente(perfil.id);
        if (!venceEn) {
            throw new AppError(
                "Necesita una verificación aprobada para publicar disponibilidad",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        if (fin.getTime() > venceEn.getTime()) {
            throw new AppError(
                "Esa franja cae después de que venza su verificación. Renuévela y vuelva a publicarla.",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        const repo = new FranjaDisponibleRepository();
        // 2) Solape con una franja suya. Una agenda con dos franjas encimadas
        //    puede comprometer dos citas en el mismo rato.
        const solapada = await repo.existeSolapada(perfil.id, inicio, fin);
        if (solapada) {
            throw new AppError("Ya tiene una franja en ese horario", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const creada = await repo.crear({
            profesional: { connect: { id: perfil.id } },
            inicio,
            fin,
            modalidad: body.modalidad,
            tomada: false,
        });
        return NextResponse.json({ data: creada });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/FRANJAS/POST]");
    }
}

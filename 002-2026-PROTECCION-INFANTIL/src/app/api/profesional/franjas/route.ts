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
        const creada = await new FranjaDisponibleRepository().crear({
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

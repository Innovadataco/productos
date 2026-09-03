/**
 * SPEC-391 (A-75 · L1b) · GET+PUT /api/profesional/perfil.
 *
 * GET: devuelve el perfil PROPIO del profesional autenticado (DTO propio, no
 *      público — incluye la bandera `autorizacionSubida` pero jamás la ruta
 *      ni la fecha exacta).
 * PUT: crea o actualiza el `PerfilProfesional` del usuario. El primer PUT crea
 *      la fila con `estado = BORRADOR`. Después de cada guardado, si el perfil
 *      está completo Y ya subió la autorización, la fila transiciona a
 *      `EN_REVISION` — ese es el disparador para que L2 la vea en su cola.
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import {
    perfilProfesionalUpdateSchema,
    type PerfilProfesionalUpdateInput,
} from "@/lib/profesional/perfil-schema";
import {
    perfilCompletoParaRevision,
    toPerfilProfesionalPropio,
} from "@/lib/profesional/dto";

async function requireProfesional() {
    const user = await verifyAuth();
    if (user.rol !== "PROFESIONAL") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return user;
}

/** Construye el `data` del create con defaults razonables para el 1er PUT. */
function armarCreate(usuarioId: string, data: PerfilProfesionalUpdateInput): Prisma.PerfilProfesionalCreateInput {
    return {
        usuario: { connect: { id: usuarioId } },
        nombreVisible: data.nombreVisible ?? "",
        fotoUrl: data.fotoUrl ?? null,
        tituloProfesional: data.tituloProfesional ?? "",
        especialidades: data.especialidades ?? [],
        ciudad: { connect: { id: data.ciudadId ?? "" } },
        atiendeVirtual: data.atiendeVirtual ?? false,
        atiendePresencial: data.atiendePresencial ?? false,
        aniosExperiencia: data.aniosExperiencia ?? 0,
        presentacion: data.presentacion ?? "",
        tarifaConsultaCOP: data.tarifaConsultaCOP ?? 0,
        duracionMinutos: data.duracionMinutos ?? 0,
        emiteFactura: data.emiteFactura ?? false,
        numeroTarjetaProfesional: data.numeroTarjetaProfesional ?? null,
        // undefined explícito ≡ omitir (exactOptionalPropertyTypes).
        ...(data.datosFacturacion !== undefined ? { datosFacturacion: data.datosFacturacion } : {}),
        estado: "BORRADOR",
    };
}

/** Solo los campos presentes en el body llegan al `update`. */
function armarUpdate(data: PerfilProfesionalUpdateInput): Prisma.PerfilProfesionalUpdateInput {
    const u: Prisma.PerfilProfesionalUpdateInput = {};
    if (data.nombreVisible !== undefined) u.nombreVisible = data.nombreVisible;
    if (data.fotoUrl !== undefined) u.fotoUrl = data.fotoUrl;
    if (data.tituloProfesional !== undefined) u.tituloProfesional = data.tituloProfesional;
    if (data.especialidades !== undefined) u.especialidades = data.especialidades;
    if (data.ciudadId !== undefined) u.ciudad = { connect: { id: data.ciudadId } };
    if (data.atiendeVirtual !== undefined) u.atiendeVirtual = data.atiendeVirtual;
    if (data.atiendePresencial !== undefined) u.atiendePresencial = data.atiendePresencial;
    if (data.aniosExperiencia !== undefined) u.aniosExperiencia = data.aniosExperiencia;
    if (data.presentacion !== undefined) u.presentacion = data.presentacion;
    if (data.tarifaConsultaCOP !== undefined) u.tarifaConsultaCOP = data.tarifaConsultaCOP;
    if (data.duracionMinutos !== undefined) u.duracionMinutos = data.duracionMinutos;
    if (data.emiteFactura !== undefined) u.emiteFactura = data.emiteFactura;
    if (data.numeroTarjetaProfesional !== undefined) u.numeroTarjetaProfesional = data.numeroTarjetaProfesional;
    if (data.datosFacturacion !== undefined) u.datosFacturacion = data.datosFacturacion;
    return u;
}

export async function GET() {
    try {
        const user = await requireProfesional();
        const perfil = await new PerfilProfesionalRepository().findConCiudadPorUsuarioId(user.id);
        if (!perfil) return NextResponse.json({ perfil: null });
        return NextResponse.json({ perfil: toPerfilProfesionalPropio(perfil) });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/PERFIL/GET]");
    }
}

export async function PUT(request: Request) {
    try {
        const user = await requireProfesional();
        const parsed = perfilProfesionalUpdateSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message ?? "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const repo = new PerfilProfesionalRepository();
        const existente = await repo.findPorUsuarioId(user.id);

        if (!existente) {
            const creado = await repo.crearBorrador(armarCreate(user.id, parsed.data));
            // El 1er PUT no puede completar (sin autorización).
            return NextResponse.json({ perfil: toPerfilProfesionalPropio(creado) }, { status: 201 });
        }

        const actualizado = await repo.actualizarParcial(existente.id, armarUpdate(parsed.data));

        // Transición BORRADOR → EN_REVISION cuando quedó completo. Otros estados
        // (ACTIVO, RECHAZADO, VENCIDO, SUSPENDIDO) los mueve L2, no un PUT del
        // propio profesional: editar el perfil no puede reactivar una cuenta.
        const final =
            actualizado.estado === "BORRADOR" && perfilCompletoParaRevision(actualizado)
                ? await repo.cambiarEstado(actualizado.id, "EN_REVISION")
                : actualizado;

        return NextResponse.json({ perfil: toPerfilProfesionalPropio(final) });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/PERFIL/PUT]");
    }
}

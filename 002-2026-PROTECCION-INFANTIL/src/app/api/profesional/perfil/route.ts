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
import { assertModulo } from "@/lib/permisos-modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { CiudadRepository } from "@/lib/dal/repositories/ciudad";
import {
    perfilProfesionalUpdateSchema,
    type PerfilProfesionalUpdateInput,
} from "@/lib/profesional/perfil-schema";
import {
    perfilCompletoParaRevision,
    toPerfilProfesionalPropio,
} from "@/lib/profesional/dto";
import { exigirModalidadParaEstado } from "@/lib/profesional/modalidad-estado";
import { validarYderivarLegado } from "@/lib/profesional/catalogos-lectura";

async function requireProfesional() {
    const user = await verifyAuth();
    if (user.rol !== "PROFESIONAL") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    // SPEC-496: el rol es la primera puerta; el módulo es la segunda. Revocar
    // `profesional_ficha` en el panel de permisos corta el acceso de verdad
    // (antes solo escondía el ítem del menú — degradación silenciosa).
    await assertModulo(user, "profesional_ficha");
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
        // SPEC-685 (PR2) · listas cerradas (claves). profesion nulable; arrays
        // vacíos por defecto (mismo trato que `especialidades`).
        profesion: data.profesion && data.profesion.length > 0 ? data.profesion : null,
        areasAtencion: data.areasAtencion ?? [],
        rangoEtario: data.rangoEtario ?? [],
        ciudad: { connect: { id: data.ciudadId ?? "" } },
        atiendeVirtual: data.atiendeVirtual ?? false,
        atiendePresencial: data.atiendePresencial ?? false,
        aniosExperiencia: data.aniosExperiencia ?? 0,
        presentacion: data.presentacion ?? "",
        // SPEC-685 (PR2-bis): la tarifa se fija en «Mi perfil» tras la habilitación.
        // NULL = «por fijar», sin 0 centinela. La duración cae a un default sensato.
        tarifaConsultaCOP: data.tarifaConsultaCOP ?? null,
        duracionMinutos: data.duracionMinutos ?? 45,
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
    // SPEC-685 (PR2) · listas cerradas. "" en profesion ≡ sin elegir → null.
    if (data.profesion !== undefined) u.profesion = data.profesion.length > 0 ? data.profesion : null;
    if (data.areasAtencion !== undefined) u.areasAtencion = data.areasAtencion;
    if (data.rangoEtario !== undefined) u.rangoEtario = data.rangoEtario;
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

        // SPEC-434 (I-302 · Jelkin vivo 04-09): antes un `ciudadId` inválido
        // caía como 500 (Prisma «no Ciudad record found»). Un dato malo del
        // usuario tiene que ser 400 con mensaje entendible, nunca 500. El
        // selector nuevo baja la probabilidad, pero el candado vive acá.
        if (parsed.data.ciudadId !== undefined && parsed.data.ciudadId !== "") {
            const ciudad = await new CiudadRepository().findById(parsed.data.ciudadId);
            if (!ciudad) {
                return NextResponse.json(
                    { error: { message: "La ciudad seleccionada no existe. Usá el buscador para elegirla.", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                );
            }
        }

        // SPEC-685 (PR2): las tres listas son CERRADAS. No basta el `<select>` del
        // cliente —un gate contra un valor del cliente falla abierto—: la ruta
        // rechaza cualquier clave fuera del catálogo vivo (parámetro editable) y,
        // de paso, DERIVA las etiquetas para las columnas legado.
        const resol = await validarYderivarLegado(parsed.data);
        if (resol.error) {
            return NextResponse.json(
                { error: { message: resol.error, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 },
            );
        }
        // Expandir-contraer sin huecos: mientras `tituloProfesional`/`especialidades`
        // sigan NOT NULL y con lectores, se escriben DESDE las claves nuevas (etiquetas
        // del catálogo) — nunca cadena vacía ni centinela. Los borra el PR4.
        const data: PerfilProfesionalUpdateInput = { ...parsed.data };
        if (resol.tituloProfesional !== undefined) data.tituloProfesional = resol.tituloProfesional;
        if (resol.especialidades !== undefined) data.especialidades = resol.especialidades;

        const repo = new PerfilProfesionalRepository();
        const existente = await repo.findPorUsuarioId(user.id);

        if (!existente) {
            const creado = await repo.crearBorrador(armarCreate(user.id, data));
            // El 1er PUT no puede completar (sin autorización).
            return NextResponse.json({ perfil: toPerfilProfesionalPropio(creado) }, { status: 201 });
        }

        // SPEC-673 (I-398): la edición no puede dejar un perfil que ya salió de
        // BORRADOR sin modalidad (un ACTIVO desmarcando ambas quedaba ACTIVO e
        // invisible, sin poder crear franjas). La invariante es del estado; el PUT
        // que completa un BORRADOR ya pasa por `perfilCompletoParaRevision`.
        exigirModalidadParaEstado(existente.estado, {
            atiendeVirtual: parsed.data.atiendeVirtual ?? existente.atiendeVirtual,
            atiendePresencial: parsed.data.atiendePresencial ?? existente.atiendePresencial,
        });

        const actualizado = await repo.actualizarParcial(existente.id, armarUpdate(data));

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

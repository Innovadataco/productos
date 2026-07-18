import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

type OperadorCandidato = {
    id: string;
    email: string;
    nombre: string | null;
    cupoMaximo: number;
    casosAbiertos: number;
};

export type ResultadoAsignacion =
    | { asignado: true; operadorId: string; operador: OperadorCandidato }
    | { asignado: false; razon: string };

function weightedRandom(candidatos: Array<{ operador: OperadorCandidato; peso: number }>): OperadorCandidato {
    const total = candidatos.reduce((acc, c) => acc + c.peso, 0);
    let random = Math.random() * total;
    for (const c of candidatos) {
        random -= c.peso;
        if (random <= 0) return c.operador;
    }
    return candidatos[candidatos.length - 1].operador;
}

export async function asignarOperadorAReporte(
    reporteId: string,
    tx?: Prisma.TransactionClient
): Promise<ResultadoAsignacion> {
    const db = tx ?? prisma;

    const reporte = await db.reporte.findUnique({
        where: { id: reporteId },
        select: { id: true, estado: true, tenantId: true, operadorId: true },
    });

    if (!reporte) {
        return { asignado: false, razon: "Reporte no encontrado" };
    }

    if (reporte.operadorId) {
        return { asignado: false, razon: "El reporte ya tiene operador asignado" };
    }

    if (reporte.estado !== "REVISION_MANUAL") {
        return { asignado: false, razon: `Estado ${reporte.estado} no admite asignación` };
    }

    const whereBase: Record<string, unknown> = {
        rol: "OPERADOR",
        estado: "activo",
        perfilOperador: { isNot: null },
    };
    if (reporte.tenantId) {
        whereBase.tenantId = reporte.tenantId;
    }

    const operadores = await db.usuario.findMany({
        where: whereBase,
        include: { perfilOperador: { select: { cupoMaximo: true } } },
    });

    if (operadores.length === 0) {
        return { asignado: false, razon: "No hay operadores activos disponibles" };
    }

    const candidatos: OperadorCandidato[] = [];
    for (const op of operadores) {
        if (!op.perfilOperador) continue;
        const casosAbiertos = await db.reporte.count({
            where: {
                operadorId: op.id,
                estado: "REVISION_MANUAL",
                eliminado: false,
            },
        });
        candidatos.push({
            id: op.id,
            email: op.email,
            nombre: op.nombre,
            cupoMaximo: op.perfilOperador.cupoMaximo,
            casosAbiertos,
        });
    }

    const disponibles = candidatos.filter((c) => c.casosAbiertos < c.cupoMaximo);

    if (disponibles.length === 0) {
        return { asignado: false, razon: "Todos los operadores activos están al cupo máximo" };
    }

    // Ponderación inversa por carga: más cupo libre = más probabilidad.
    const ponderados = disponibles.map((op) => ({
        operador: op,
        peso: (op.cupoMaximo - op.casosAbiertos) / op.cupoMaximo,
    }));

    const elegido = weightedRandom(ponderados);

    await db.reporte.update({
        where: { id: reporteId },
        data: { operadorId: elegido.id },
    });

    await logAudit({
        accion: "OPERADOR_ASIGNADO",
        tipoRecurso: "Reporte",
        recursoId: reporteId,
        usuarioId: elegido.id,
        valorNuevo: JSON.stringify({ operadorId: elegido.id, operadorEmail: elegido.email, operadorNombre: elegido.nombre }),
        tx,
    });

    return { asignado: true, operadorId: elegido.id, operador: elegido };
}

export async function asignarOperadorAApelacion(
    apelacionId: string,
    tx?: Prisma.TransactionClient
): Promise<ResultadoAsignacion> {
    const db = tx ?? prisma;

    const apelacion = await db.apelacionIdentificador.findUnique({
        where: { id: apelacionId },
        select: { id: true, estado: true, plataformaId: true, operadorId: true },
    });

    if (!apelacion) {
        return { asignado: false, razon: "Apelación no encontrada" };
    }

    if (apelacion.operadorId) {
        return { asignado: false, razon: "La apelación ya tiene revisor asignado" };
    }

    const whereBase: Record<string, unknown> = {
        rol: "OPERADOR",
        estado: "activo",
        perfilOperador: { esRevisorDeApelaciones: true },
    };

    const revisores = await db.usuario.findMany({
        where: whereBase,
        include: { perfilOperador: { select: { cupoMaximo: true } } },
    });

    if (revisores.length === 0) {
        return { asignado: false, razon: "No hay revisores de apelaciones activos" };
    }

    const candidatos: OperadorCandidato[] = [];
    for (const op of revisores) {
        if (!op.perfilOperador) continue;
        const casosAbiertos = await db.apelacionIdentificador.count({
            where: {
                operadorId: op.id,
                estado: { in: ["RECIBIDA", "EN_REVISION"] },
            },
        });
        candidatos.push({
            id: op.id,
            email: op.email,
            nombre: op.nombre,
            cupoMaximo: op.perfilOperador.cupoMaximo,
            casosAbiertos,
        });
    }

    const disponibles = candidatos.filter((c) => c.casosAbiertos < c.cupoMaximo);
    if (disponibles.length === 0) {
        return { asignado: false, razon: "Todos los revisores de apelaciones están al cupo" };
    }

    const ponderados = disponibles.map((op) => ({
        operador: op,
        peso: (op.cupoMaximo - op.casosAbiertos) / op.cupoMaximo,
    }));
    const elegido = weightedRandom(ponderados);

    await db.apelacionIdentificador.update({
        where: { id: apelacionId },
        data: { operadorId: elegido.id, estado: "EN_REVISION" },
    });

    await logAudit({
        accion: "OPERADOR_ASIGNADO",
        tipoRecurso: "ApelacionIdentificador",
        recursoId: apelacionId,
        usuarioId: elegido.id,
        valorNuevo: JSON.stringify({ operadorId: elegido.id, operadorEmail: elegido.email, operadorNombre: elegido.nombre }),
        tx,
    });

    return { asignado: true, operadorId: elegido.id, operador: elegido };
}

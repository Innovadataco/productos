import { logAudit } from "@/lib/audit";
import { getParametroSistemaValor } from "@/lib/parametros";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
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

export type EstrategiaAsignacion = "ponderado_carga_inversa" | "aleatorio_puro";

type ConfigAsignacion = {
    cupoDefault: number;
    estrategia: EstrategiaAsignacion;
};

export async function obtenerConfigAsignacion(client?: Prisma.TransactionClient): Promise<ConfigAsignacion> {
    const cupoRaw = await getParametroSistemaValor("operadores.cupo_maximo_default", client);
    const estrategiaRaw = await getParametroSistemaValor("operadores.estrategia_asignacion", client);

    const cupoDefault = cupoRaw ? parseInt(cupoRaw, 10) || 10 : 10;
    const estrategia: EstrategiaAsignacion =
        estrategiaRaw === "aleatorio_puro" ? "aleatorio_puro" : "ponderado_carga_inversa";

    return { cupoDefault, estrategia };
}

function weightedRandom(candidatos: Array<{ operador: OperadorCandidato; peso: number }>): OperadorCandidato {
    const total = candidatos.reduce((acc, c) => acc + c.peso, 0);
    let random = Math.random() * total;
    for (const c of candidatos) {
        random -= c.peso;
        if (random <= 0) return c.operador;
    }
    return candidatos[candidatos.length - 1].operador;
}

function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function construirCandidatos(
    operadores: Array<{ id: string; email: string; nombre: string | null; perfilOperador: { cupoMaximo: number | null } | null }>,
    contarCasos: (operadorId: string) => Promise<number>,
    config: ConfigAsignacion
) {
    const candidatos: OperadorCandidato[] = [];
    for (const op of operadores) {
        if (!op.perfilOperador) continue;
        const casosAbiertos = await contarCasos(op.id);
        candidatos.push({
            id: op.id,
            email: op.email,
            nombre: op.nombre,
            cupoMaximo: op.perfilOperador.cupoMaximo ?? config.cupoDefault,
            casosAbiertos,
        });
    }
    return candidatos;
}

function seleccionarOperador(
    disponibles: OperadorCandidato[],
    estrategia: EstrategiaAsignacion
): OperadorCandidato {
    if (estrategia === "aleatorio_puro") {
        return randomChoice(disponibles);
    }

    // Ponderación inversa por carga: más cupo libre = más probabilidad.
    const ponderados = disponibles.map((op) => ({
        operador: op,
        peso: (op.cupoMaximo - op.casosAbiertos) / op.cupoMaximo,
    }));

    return weightedRandom(ponderados);
}

export async function asignarOperadorAReporte(
    reporteId: string,
    tx?: Prisma.TransactionClient
): Promise<ResultadoAsignacion> {
    // E-8: las lecturas/escrituras viven en los repos; la lógica de asignación no cambia.
    const reportes = new ReporteRepository(tx);

    const [reporte, config] = await Promise.all([
        reportes.findPermisosGestionBasico(reporteId),
        obtenerConfigAsignacion(tx),
    ]);

    if (!reporte) {
        return { asignado: false, razon: "Reporte no encontrado" };
    }

    if (reporte.operadorId) {
        return { asignado: false, razon: "El reporte ya tiene operador asignado" };
    }

    if (reporte.estado !== "REVISION_MANUAL" && reporte.estado !== "POSIBLE_SPAM") {
        return { asignado: false, razon: `Estado ${reporte.estado} no admite asignación` };
    }

    const operadores = await new UsuarioRepository(tx).findOperadoresActivosConPerfil(reporte.tenantId ?? undefined);

    if (operadores.length === 0) {
        return { asignado: false, razon: "No hay operadores activos disponibles" };
    }

    const candidatos = await construirCandidatos(
        operadores,
        (operadorId) =>
            reportes.countWhere({ operadorId, estado: { in: ["REVISION_MANUAL", "POSIBLE_SPAM"] }, eliminado: false }),
        config
    );

    const disponibles = candidatos.filter((c) => c.casosAbiertos < c.cupoMaximo);

    if (disponibles.length === 0) {
        return { asignado: false, razon: "Todos los operadores activos están al cupo máximo" };
    }

    const elegido = seleccionarOperador(disponibles, config.estrategia);

    await reportes.actualizarEstado(reporteId, { operadorId: elegido.id });

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


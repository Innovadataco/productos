import { prisma } from "@/lib/prisma";

export type EstadoVigencia = "vigente" | "no_iniciado" | "vencido" | "inactivo" | "sin_colegio";

export interface ResultadoVigencia {
    vigente: boolean;
    estado: EstadoVigencia;
    mensaje: string;
}

export async function verificarVigenciaColegio(usuarioId: string): Promise<ResultadoVigencia> {
    const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { rol: true, colegioId: true },
    });

    if (!usuario || usuario.rol !== "SCHOOL_ADMIN") {
        return { vigente: true, estado: "vigente", mensaje: "" };
    }

    if (!usuario.colegioId) {
        return {
            vigente: false,
            estado: "sin_colegio",
            mensaje: "Tu cuenta institucional no está vinculada a un colegio. Contacta al administrador.",
        };
    }

    return verificarVigenciaPorColegioId(usuario.colegioId);
}

export async function verificarVigenciaPorColegioId(colegioId: string): Promise<ResultadoVigencia> {
    const colegio = await prisma.colegio.findUnique({
        where: { id: colegioId },
        select: { id: true, estado: true, inicioServicio: true, finServicio: true },
    });

    if (!colegio) {
        return {
            vigente: false,
            estado: "sin_colegio",
            mensaje: "No se encontró la información del colegio. Contacta al administrador.",
        };
    }

    if (colegio.estado !== "activo") {
        return {
            vigente: false,
            estado: "inactivo",
            mensaje: "El servicio del colegio no está activo. Contacta al administrador.",
        };
    }

    const hoy = hoyNormalizado();
    if (normalizarFechaServicio(colegio.inicioServicio) > hoy) {
        return {
            vigente: false,
            estado: "no_iniciado",
            mensaje: "El servicio del colegio aún no ha comenzado. Contacta al administrador.",
        };
    }

    if (colegio.finServicio && normalizarFechaServicio(colegio.finServicio) < hoy) {
        return {
            vigente: false,
            estado: "vencido",
            mensaje: "El servicio del colegio ha vencido. Contacta al administrador.",
        };
    }

    return { vigente: true, estado: "vigente", mensaje: "" };
}

export function normalizarFechaServicio(fecha: Date): Date {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function hoyNormalizado(): Date {
    return normalizarFechaServicio(new Date());
}

export function estaDentroDeRango(hoy: Date, inicio: Date, fin?: Date | null): boolean {
    const inicioNorm = normalizarFechaServicio(inicio);
    if (hoy < inicioNorm) return false;
    if (fin) {
        const finNorm = normalizarFechaServicio(fin);
        if (hoy > finNorm) return false;
    }
    return true;
}

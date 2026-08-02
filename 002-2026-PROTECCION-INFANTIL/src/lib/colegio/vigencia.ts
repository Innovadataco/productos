import { AppError, ERROR_CODES } from "@/lib/errors";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

// SPEC-134 (E-1): el acceso a datos vive en los repos del DAL; la lógica de
// vigencia (ventanas, mensajes, estados) queda intacta en este módulo.

export type EstadoVigencia = "vigente" | "no_iniciado" | "vencido" | "inactivo" | "sin_colegio";

export interface ResultadoVigencia {
    vigente: boolean;
    estado: EstadoVigencia;
    mensaje: string;
}

const VIGENTE: ResultadoVigencia = { vigente: true, estado: "vigente", mensaje: "" };

/**
 * SPEC-119: única función que decide la vigencia del servicio de un cliente.
 * - SCHOOL_ADMIN: la ventana es la de su Colegio (inicioServicio/finServicio del colegio).
 * - PARENT: su propia ventana en Usuario (inicioServicio/finServicio); null = sin vigencia
 *   definida = acceso permitido (nadie se corta por omisión del dato).
 * - Roles internos (ADMIN, OPERADOR, COMITE_VALIDACION): siempre vigentes.
 *
 * Puntos de aplicación documentados (NO el middleware: corre en edge sin BD):
 * login (POST /api/auth/login), layouts de cliente (dashboard/colegio, mis-reportes,
 * dashboard) y APIs de cliente (/api/colegio/**, POST /api/reportes autenticado,
 * GET /api/reportes/mis-reportes(/[id])).
 */
export async function verificarVigenciaCliente(usuarioId: string): Promise<ResultadoVigencia> {
    const usuario = await new UsuarioRepository().findVigenciaCliente(usuarioId);

    if (!usuario) {
        return { ...VIGENTE };
    }

    if (usuario.rol === "SCHOOL_ADMIN") {
        if (!usuario.colegioId) {
            return {
                vigente: false,
                estado: "sin_colegio",
                mensaje: "Tu cuenta institucional no está vinculada a un colegio. Contacta al administrador.",
            };
        }
        return verificarVigenciaPorColegioId(usuario.colegioId);
    }

    if (usuario.rol === "PARENT") {
        return verificarVentanaServicioPadre(usuario.inicioServicio, usuario.finServicio);
    }

    return { ...VIGENTE };
}

/**
 * Alias de compatibilidad (SPEC-119): los puntos existentes del módulo colegio (layout +
 * APIs /api/colegio/** + /api/me/colegio) la siguen llamando; delega en la función
 * generalizada con idéntico resultado para SCHOOL_ADMIN.
 */
export async function verificarVigenciaColegio(usuarioId: string): Promise<ResultadoVigencia> {
    return verificarVigenciaCliente(usuarioId);
}

/**
 * Helper para APIs de cliente (SPEC-119): lanza AppError 403 con el mensaje de vigencia
 * (qué pasó y a quién acudir) si el cliente está cortado. Las rutas lo capturan con su
 * catch habitual de AppError.
 */
export async function assertVigenciaCliente(usuarioId: string): Promise<void> {
    const vigencia = await verificarVigenciaCliente(usuarioId);
    if (!vigencia.vigente) {
        throw new AppError(vigencia.mensaje, ERROR_CODES.FORBIDDEN, 403);
    }
}

/** Ventana de servicio propia del padre (SPEC-119): null = sin definir = acceso. */
function verificarVentanaServicioPadre(inicio: Date | null, fin: Date | null): ResultadoVigencia {
    const hoy = hoyNormalizado();

    if (inicio && normalizarFechaServicio(inicio) > hoy) {
        return {
            vigente: false,
            estado: "no_iniciado",
            mensaje: "Tu acceso al servicio aún no ha comenzado. Si crees que es un error, contacta con el soporte de la plataforma.",
        };
    }

    if (fin && normalizarFechaServicio(fin) < hoy) {
        return {
            vigente: false,
            estado: "vencido",
            mensaje: "Tu período de servicio ha vencido. Tus reportes e información siguen guardados. Contacta con el soporte de la plataforma para renovar tu acceso.",
        };
    }

    return { ...VIGENTE };
}

export async function verificarVigenciaPorColegioId(colegioId: string): Promise<ResultadoVigencia> {
    const colegio = await new ColegioRepository().obtenerVigencia(colegioId);

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

    return { ...VIGENTE };
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

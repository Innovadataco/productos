/**
 * SPEC-242 (002-PI-145): helper puro de vigencia para layouts de dashboard.
 * No introduce middleware.ts global; se consume desde Server Components de layout.
 */
import { toZonedTime } from "date-fns-tz";
import { EstadoSuscripcion } from "@prisma/client";
import type { Suscripcion, RolUsuario } from "@prisma/client";

export const ZONA_BOGOTA = "America/Bogota";

export type EstadoVigenciaEfectivo = EstadoSuscripcion | "SIN_SUSCRIPCION";

/**
 * Devuelve la hora actual en timezone Bogotá. Punto único de obtención de "ahora"
 * para todas las decisiones de vigencia de este SPEC.
 */
export function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

/**
 * Resuelve el estado efectivo de vigencia a partir de la suscripción almacenada.
 * La fuente única de verdad es `Suscripcion.estado` (SPEC-213); este helper solo
 * lo expone como tipo cerrado y aplica salvaguarda de timezone en la frontera.
 */
export function resolverEstadoVigencia(suscripcion: Suscripcion | null | undefined): EstadoVigenciaEfectivo {
    if (!suscripcion) return "SIN_SUSCRIPCION";
    return suscripcion.estado;
}

/**
 * Determina si una ruta debe quedar exenta de la guarda de vigencia.
 * - /consentimiento: encadenamiento con SPEC-241.
 * - /perfil, /suscripcion: rutas de gestión propia nunca bloqueadas.
 * - /reportar: solo padre; excepción social crítica (proteger menores > cobrar).
 */
export function esRutaExenta(pathname: string, rol: RolUsuario): boolean {
    const normalizada = pathname.replace(/\/$/, "") || "/";
    const exentasComunes = ["/consentimiento", "/perfil", "/suscripcion"];
    if (exentasComunes.some((ruta) => normalizada.endsWith(ruta))) return true;
    if (rol === "PARENT" && normalizada.startsWith("/reportar")) return true;
    return false;
}

/**
 * URL de redirección al flujo de suscripción según rol.
 */
export function redireccionSuscripcion(rol: RolUsuario): string {
    if (rol === "PARENT") return "/dashboard/padre/suscripcion";
    if (rol === "SCHOOL_ADMIN" || rol === "COMITE_CONVIVENCIA") return "/dashboard/colegio/suscripcion";
    return "/dashboard/padre/suscripcion";
}

/**
 * Indica si el estado amerita mostrar el banner ámbar de advertencia.
 */
export function debeMostrarBanner(estado: EstadoVigenciaEfectivo): boolean {
    return estado === EstadoSuscripcion.EN_GRACIA;
}

/**
 * Mensaje descriptivo/neutro para cada estado de vigencia.
 */
export function mensajeParaEstado(estado: EstadoVigenciaEfectivo): string {
    switch (estado) {
        case EstadoSuscripcion.ACTIVA:
            return "Tu plan está activo.";
        case EstadoSuscripcion.EN_GRACIA:
            return "Tu plan vence pronto. Renueva para no perder el acceso.";
        case EstadoSuscripcion.SUSPENDIDA:
            return "Tu suscripción está suspendida. Elige un plan para restaurar el acceso.";
        case EstadoSuscripcion.CANCELADA:
            return "Tu suscripción fue cancelada. Elige un plan para continuar.";
        case EstadoSuscripcion.PENDIENTE_AUTORIZACION:
            return "Tu suscripción está pendiente de autorización.";
        case "SIN_SUSCRIPCION":
            return "Elige un plan para continuar.";
        default:
            return "Elige un plan para continuar.";
    }
}

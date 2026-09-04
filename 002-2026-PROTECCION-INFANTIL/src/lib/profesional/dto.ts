/**
 * SPEC-391 · DTO público del `PerfilProfesional`.
 *
 * La regla de reserva (Ley 2375/2024 + brief §2 + veredicto CEO 08:40):
 *   NUNCA salen por API pública `numeroTarjetaProfesional`, `datosFacturacion`,
 *   `autorizacionArchivoId` ni `autorizacionSubidaEn`. Los datos personales
 *   heredados de `Usuario` (`fechaNacimiento`, `documentoTipo`,
 *   `documentoNumero`) TAMPOCO — se reusan del modelo pero no se serializan.
 *
 * Este helper es un `select` explícito con allowlist: si mañana alguien agrega
 * un campo interno al `PerfilProfesional`, el DTO no lo incluye por defecto —
 * un test unitario lo afirma golpeando todas las claves del objeto de retorno.
 */
import type { PerfilProfesional, Ciudad } from "@prisma/client";

/** Campos que exponemos hacia el directorio abierto (L3). */
export interface PerfilProfesionalPublicoDto {
    id: string;
    nombreVisible: string;
    fotoUrl: string | null;
    tituloProfesional: string;
    especialidades: string[];
    ciudad: { id: string; nombre: string };
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    aniosExperiencia: number;
    presentacion: string;
    tarifaConsultaCOP: number;
    duracionMinutos: number;
    emiteFactura: boolean;
    estado: string;
}

/** Campos que ve el propio profesional al leer SU perfil (incluye el estado
 *  para saber si ya está EN_REVISION, y una bandera «autorización subida»
 *  pero NUNCA la ruta cifrada ni la fecha exacta — L2 y él bastan con
 *  saber que ya la subió). */
export interface PerfilProfesionalPropioDto extends PerfilProfesionalPublicoDto {
    autorizacionSubida: boolean;
}

/**
 * Los campos internos que este DTO nunca debe llevar. Se exporta para el test
 * de reserva: rompemos si algún día alguno se cuela.
 */
export const CAMPOS_INTERNOS_PROFESIONAL = [
    "numeroTarjetaProfesional",
    "datosFacturacion",
    "autorizacionArchivoId",
    "autorizacionSubidaEn",
] as const;

type PerfilConCiudad = PerfilProfesional & { ciudad: Pick<Ciudad, "id" | "nombre"> };

function base(perfil: PerfilConCiudad): PerfilProfesionalPublicoDto {
    return {
        id: perfil.id,
        nombreVisible: perfil.nombreVisible,
        fotoUrl: perfil.fotoUrl,
        tituloProfesional: perfil.tituloProfesional,
        especialidades: perfil.especialidades,
        ciudad: { id: perfil.ciudad.id, nombre: perfil.ciudad.nombre },
        atiendeVirtual: perfil.atiendeVirtual,
        atiendePresencial: perfil.atiendePresencial,
        aniosExperiencia: perfil.aniosExperiencia,
        presentacion: perfil.presentacion,
        tarifaConsultaCOP: perfil.tarifaConsultaCOP,
        duracionMinutos: perfil.duracionMinutos,
        emiteFactura: perfil.emiteFactura,
        estado: perfil.estado,
    };
}

export function toPerfilProfesionalPublico(perfil: PerfilConCiudad): PerfilProfesionalPublicoDto {
    return base(perfil);
}

export function toPerfilProfesionalPropio(perfil: PerfilConCiudad): PerfilProfesionalPropioDto {
    return {
        ...base(perfil),
        autorizacionSubida: perfil.autorizacionArchivoId !== null,
    };
}

/** Verifica si el perfil está listo para pasar a `EN_REVISION`: todos los
 *  campos obligatorios llenos + autorización subida. Es la regla que dispara
 *  la transición cuando el profesional termina de rellenar. */
export function perfilCompletoParaRevision(perfil: PerfilProfesional): boolean {
    return (
        perfil.nombreVisible.trim().length > 0 &&
        perfil.tituloProfesional.trim().length > 0 &&
        perfil.especialidades.length > 0 &&
        perfil.ciudadId.length > 0 &&
        (perfil.atiendeVirtual || perfil.atiendePresencial) &&
        perfil.aniosExperiencia >= 0 &&
        perfil.presentacion.trim().length > 0 &&
        perfil.tarifaConsultaCOP > 0 &&
        perfil.duracionMinutos > 0 &&
        perfil.autorizacionArchivoId !== null
    );
}

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
    // SPEC-685 (PR2-bis): la tarifa se fija tras la habilitación. `null` = «por fijar»;
    // el consumidor NO la muestra cuando es null (nunca un 0 ni un precio inventado).
    tarifaConsultaCOP: number | null;
    duracionMinutos: number;
    emiteFactura: boolean;
    estado: string;
}

/** Campos que ve el propio profesional al leer SU perfil (incluye el estado
 *  para saber si ya está EN_REVISION, y una bandera «autorización subida»
 *  pero NUNCA la ruta cifrada ni la fecha exacta — L2 y él bastan con
 *  saber que ya la subió).
 *  SPEC-434 (I-302): agregamos `paisId` a la ciudad — la pantalla de completar
 *  necesita el país para armar el `CiudadSearchSelect` al recargar. Es vista
 *  propia, no rompe la reserva del directorio público. */
export interface PerfilProfesionalPropioDto extends Omit<PerfilProfesionalPublicoDto, "ciudad"> {
    ciudad: { id: string; nombre: string; paisId: string };
    autorizacionSubida: boolean;
    // SPEC-685 (PR2) · listas cerradas de la ficha (claves, no nombres). La vista
    // PROPIA las devuelve para que la ficha recargue lo ya elegido. El DTO PÚBLICO
    // (directorio) las suma en el PR del directorio (PR5), no acá.
    profesion: string | null;
    areasAtencion: string[];
    rangoEtario: string[];
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

type PerfilConCiudad = PerfilProfesional & { ciudad: Pick<Ciudad, "id" | "nombre" | "paisId"> };

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
        ciudad: { id: perfil.ciudad.id, nombre: perfil.ciudad.nombre, paisId: perfil.ciudad.paisId },
        // SPEC-436 renombró `autorizacionArchivoUrl` a `autorizacionArchivoId`.
        autorizacionSubida: perfil.autorizacionArchivoId !== null,
        // SPEC-685 (PR2): claves de las listas cerradas, para recargar la ficha.
        profesion: perfil.profesion,
        areasAtencion: perfil.areasAtencion,
        rangoEtario: perfil.rangoEtario,
    };
}

/** Verifica si el perfil está listo para pasar a `EN_REVISION`: todos los
 *  campos obligatorios llenos + la autorización ACEPTADA EN PANTALLA. Es la regla
 *  que dispara la transición cuando el profesional termina de rellenar.
 *
 *  SPEC-703: la completitud exige `aceptoAutorizacionVigente` — la aceptación en
 *  pantalla de la versión vigente (Ley 1918/2018), NO el PDF. El cutover de
 *  SPEC-686 hizo que `decidir` exija esa aceptación; si la completitud siguiera
 *  contando el archivo, un alta nueva pasaría a revisión sin aceptar y el
 *  verificador daría 409. La aceptación vive en otra tabla (por usuario), así que
 *  se pasa como booleano; el llamador lo calcula con
 *  `AutorizacionProfesionalService.yaAceptoVersionVigente`. Los archivos legacy
 *  (`autorizacionArchivoId`) quedan como historia, ya no gatean. */
export function perfilCompletoParaRevision(
    perfil: PerfilProfesional,
    aceptoAutorizacionVigente: boolean,
): boolean {
    return camposFaltantesParaRevision(perfil, aceptoAutorizacionVigente).length === 0;
}

/**
 * SPEC-706 (ampliación · Jelkin): los campos OBLIGATORIOS que le FALTAN al perfil para pasar a
 * revisión, con su ETIQUETA humana (voz «usted», la misma que muestra la ficha). Vacío = listo.
 *
 * Es la fuente ÚNICA de «qué falta»: el botón «Guardar y enviar a revisión» del cliente se inactiva
 * con esta lista y la nombra, y el SERVIDOR la usa para rechazar el envío nombrando el campo (antes
 * la transición era silenciosa: un `rangoEtario` vacío dejaba el perfil en BORRADOR sin decir nada,
 * y el profesional creía que había enviado). Las etiquetas espejan los labels de `completar`.
 *
 * SPEC-685 (PR2): las listas son CERRADAS (profesión única + ≥1 área + ≥1 rango). La tarifa/duración
 * NO gatean: viven en «Mi perfil» del habilitado. La autorización se ACEPTA en pantalla (SPEC-703).
 */
export function camposFaltantesParaRevision(
    perfil: PerfilProfesional,
    aceptoAutorizacionVigente: boolean,
): string[] {
    const faltan: string[] = [];
    if (perfil.nombreVisible.trim().length === 0) faltan.push("Nombre público");
    if ((perfil.profesion?.trim().length ?? 0) === 0) faltan.push("Profesión");
    if (perfil.areasAtencion.length === 0) faltan.push("Áreas de atención");
    if (perfil.rangoEtario.length === 0) faltan.push("Edad que atiende");
    if (perfil.ciudadId.length === 0) faltan.push("Ciudad");
    if (!perfil.atiendeVirtual && !perfil.atiendePresencial) faltan.push("Cómo atiende (virtual o presencial)");
    if (perfil.aniosExperiencia < 1) faltan.push("Años de experiencia");
    if (perfil.presentacion.trim().length === 0) faltan.push("Presentación");
    if (!aceptoAutorizacionVigente) faltan.push("Aceptar la autorización");
    return faltan;
}

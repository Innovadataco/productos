/**
 * SPEC-751 · reglas PURAS de la puerta de AUDIENCIA del menor (Decreto 1377/2013 art. 12).
 *
 * Sin BD (import-light) para que el candado las pruebe como unit y para que la decisión de
 * «¿el titular está al día?» tenga UNA sola fuente. El CONSUMO (consultar `AudienciaMenor`,
 * leer el parámetro de política) lo cablea el servicio cuando exista la tabla (Datos · SPEC-765).
 *
 * Dos ejes, en orden:
 *  1. Consentimiento de CUENTA vigente (SPEC-241) — MANDA primero. Si no está vigente, el titular
 *     NO está al día sin importar los menores: esto NO debilita la puerta de cuenta existente.
 *  2. Cada menor ACTIVO oído para la versión vigente — dimensión NUEVA, per-menor.
 *
 * La política de «re-oír al cambiar la versión» es parametrizable (FR-008 · `audiencia_menor.
 * reoir_en_cambio_de_version`, default `true`; la decisión legal es [ABOGADO]):
 *  · `true`  → «al día» exige una audiencia con la versión VIGENTE (re-oír en cada bump).
 *  · `false` → basta haber sido oído UNA vez (cualquier versión).
 */

import { esSuperficieDeProteccion } from "@/lib/routing/guardias";

/** ¿Este menor fue oído lo suficiente? `versionesAudiencia` = versiones de sus filas de audiencia. */
export function menorEstaAlDia(
    versionesAudiencia: readonly string[],
    versionActual: string,
    reoirEnCambioDeVersion: boolean,
): boolean {
    if (versionesAudiencia.length === 0) return false; // nunca oído → nunca al día
    if (!reoirEnCambioDeVersion) return true; // política: una audiencia basta
    return versionesAudiencia.includes(versionActual); // política: re-oír por versión
}

export interface MenorActivoAudiencia {
    hijoId: string;
    /** Versiones de consentimiento bajo las que ESTE menor tiene audiencia registrada. */
    versionesAudiencia: readonly string[];
}

/**
 * Los menores ACTIVOS que faltan por oír para la versión vigente (per-menor: oír a uno NO
 * cubre a los demás). Devuelve sus `hijoId` para que la puerta sepa a cuál llevar.
 */
export function menoresPendientesDeAudiencia(
    menoresActivos: readonly MenorActivoAudiencia[],
    versionActual: string,
    reoirEnCambioDeVersion: boolean,
): string[] {
    return menoresActivos
        .filter((m) => !menorEstaAlDia(m.versionesAudiencia, versionActual, reoirEnCambioDeVersion))
        .map((m) => m.hijoId);
}

/**
 * ¿El titular está «al día»? Consentimiento de cuenta vigente (241) **Y** cero menores ACTIVOS
 * pendientes de audiencia. El eje de cuenta manda primero (no se debilita 241).
 */
export function titularAlDia(
    consentimientoCuentaVigente: boolean,
    menoresActivos: readonly MenorActivoAudiencia[],
    versionActual: string,
    reoirEnCambioDeVersion: boolean,
): boolean {
    if (!consentimientoCuentaVigente) return false;
    return menoresPendientesDeAudiencia(menoresActivos, versionActual, reoirEnCambioDeVersion).length === 0;
}

/**
 * ENFORCEMENT a nivel de RUTA de la compuerta de audiencia: ¿debe DETENER esta navegación?
 *
 * INVARIANTE DE PRODUCTO (CEO): NUNCA sobre una superficie de protección (reporte / canal de
 * emergencia), pase lo que pase con `titularAlDia`. Es imposibilidad estructural, no una rama
 * olvidable: el gate cortocircuita en la protección ANTES de mirar el estado del titular. El
 * redirect real (a la declaración de audiencia) lo cablea el guard cuando exista la tabla
 * (SPEC-765); esta función es su REGLA, y el candado `proteccion-siempre-abierta` la vigila.
 */
export function audienciaGateDetiene(pathname: string, titularEstaAlDia: boolean): boolean {
    if (esSuperficieDeProteccion(pathname)) return false;
    return !titularEstaAlDia;
}

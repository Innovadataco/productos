/**
 * SPEC-785 (MOTOR) · Derivación del RASTRO DE ACCESOS del titular (padre) a SUS datos.
 *
 * Ley 1581/2012 (art. 8 lit. a · art. 4 lit. f, transparencia): el titular puede ver quién
 * accedió a su información. Esta es la PARTE DIFÍCIL (derivación + DTO + filtro por titular); la
 * SUPERFICIE la construye SPEC-772 parte 2 (para no tener dos vistas del mismo derecho). Este
 * módulo es `hueco-funcional` hasta que esa vista lo importe (salida autoexigida en la allowlist).
 *
 * FUENTE: `LecturaReporte` (SPEC-584), no `AuditLog`. Dos razones (medidas, veredicto CEO):
 *  1. Guarda el `rol` como INSTANTÁNEA del momento de la lectura. Con AuditLog habría que mirar el
 *     rol ACTUAL del actor, y si cambió de rol le mostraríamos al padre una versión falsa de quién
 *     lo leyó — un rastro que reescribe el pasado no es un rastro.
 *  2. No tiene campo de metadatos operativos → la fuga es IMPOSIBLE por construcción (no hay crudos
 *     que recortar por nombre). Estructura, no una lista que alguien mantiene.
 *
 * QUÉ SALE: rol (instantánea) + calidad (PLATAFORMA/EXTERNO) + qué campo + cuándo. NUNCA la
 * identidad del lector.
 *
 * ── DOS LÍMITES DECLARADOS (cosas que el usuario podría asumir y NO están; ver spec.md) ─────────
 *  · ALCANCE: cubre accesos al TEXTO del reporte/expediente. NO cubre el acceso del admin al
 *    CÍRCULO DE CONFIANZA (vive solo en AuditLog). Cuando 772 arme la superficie: o se suma ese
 *    acceso, o el texto dice qué cubre y qué no. El rastro NUNCA se presenta como «todos los
 *    accesos»: parcial rotulado como parcial es honesto; parcial presentado como completo es una
 *    falsa tranquilidad, peor que no tener la función.
 *  · AUTOACCESO/SUPLANTACIÓN: se excluye el acceso del propio titular (su actividad es otra
 *    función — seguridad de cuenta, no habeas data). Consecuencia: si alguien SUPLANTA al padre y
 *    entra con su cuenta, ese acceso NO aparece (se registra como acceso del titular). El habeas
 *    data no es el lugar para detectarlo; se declara para no dar falsa expectativa.
 */
import { LecturaReporteRepository } from "../repositories/lectura-reporte";

/** Un acceso de un tercero al dato del titular. SIN identidad del lector, sin contenido. */
export interface AccesoAlDatoTitularDto {
    /** ISO-8601 UTC del momento de la lectura. */
    momento: string;
    /** Rol del lector, INSTANTÁNEA al momento (no el actual). `null` si no quedó registrado. */
    rol: string | null;
    /** En qué calidad: `PLATAFORMA` (staff autenticado) o `EXTERNO` (sesión por código temporal). */
    tipoActor: string;
    /** Qué se vio: `texto` (relato de trabajo) o `textoOriginal` (evidencia). */
    campo: string;
}

/**
 * El rastro de accesos de TERCEROS al dato del titular, más reciente primero. Consulta PURA (no
 * registra su propia ejecución): el motor no escribe, y el rastro excluye al titular, así que
 * consultarlo nunca se auto-alimenta (la sonda no actúa sobre lo que mide).
 */
export async function rastroDeAccesosDelTitular(
    titularId: string,
    limite = 100,
): Promise<AccesoAlDatoTitularDto[]> {
    const filas = await new LecturaReporteRepository().rastroDeAccesosDelTitular(titularId, limite);
    return filas.map((f) => ({
        momento: f.creadoEn.toISOString(),
        rol: f.rol,
        tipoActor: f.tipoActor,
        campo: f.campo,
    }));
}

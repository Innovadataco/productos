/**
 * SPEC-686 (I-420) · Servicio de la AUTORIZACIÓN del profesional aceptada EN PANTALLA.
 *
 * Mismo MECANISMO que `ConsentimientoService` (documento legal versionado por parámetro,
 * hash SHA-256 del texto, registro inmutable de versión + fecha + IP), distinto DESTINO:
 * va a `aceptaciones_autorizacion_profesional`, NUNCA a `audit_consentimientos` — el
 * profesional es el PRESTADOR, no el titular del dato (roles-titulares.ts). No se guarda
 * «aceptó»: se guarda QUÉ TEXTO EXACTO aceptó.
 *
 * La ANTERIORIDAD (Ley 1918/2018 · Decreto 753/2019: la autorización debe ser PREVIA a la
 * consulta de antecedentes) la sirve `aceptacionAntesDe`, que consume el verificador.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AceptacionAutorizacionProfesional } from "@prisma/client";
import { AppError, ERROR_CODES } from "../../errors";
import { getParametroSistemaValor } from "../../parametros";
import { AceptacionAutorizacionProfesionalRepository } from "../repositories/aceptacion-autorizacion-profesional";
import type { DbClient } from "../unit-of-work";

export const CLAVE_VERSION_AUTORIZACION = "autorizacion_profesional.version_actual";
export const CLAVE_RUTA_AUTORIZACION = "autorizacion_profesional.documento_ruta";
/**
 * SPEC-686 · «cuánto» cambió la versión vigente lo declara quien la publica (CEO/abogado):
 * FONDO (cambia QUÉ autoriza) → re-aceptación FORZADA por la guardia; MENOR (redacción) →
 * aviso suave, no bloqueo. Default FONDO: forzar es el lado seguro (la primera versión, v0.1,
 * se trata como FONDO — todos la aceptan, incluidos los ACTIVOS con archivo legacy).
 */
export const CLAVE_TIPO_AUTORIZACION = "autorizacion_profesional.version_tipo";
export type TipoVersionAutorizacion = "FONDO" | "MENOR";

export interface AceptarAutorizacionInput {
    usuarioId: string;
    ip: string;
    userAgent: string | null;
}

export class AutorizacionProfesionalService {
    private readonly repo: AceptacionAutorizacionProfesionalRepository;
    constructor(tx?: DbClient) {
        this.repo = new AceptacionAutorizacionProfesionalRepository(tx);
    }

    /** Versión vigente del texto de autorización (parámetro). */
    async versionVigente(): Promise<string> {
        const version = await getParametroSistemaValor(CLAVE_VERSION_AUTORIZACION);
        if (!version) {
            throw new AppError("Versión de autorización no configurada", ERROR_CODES.INTERNAL_ERROR, 500);
        }
        return version;
    }

    /** Lee el texto legal vigente desde la ruta parametrizada. */
    async obtenerDocumentoVigente(): Promise<string> {
        const ruta = await getParametroSistemaValor(CLAVE_RUTA_AUTORIZACION);
        if (!ruta) {
            throw new AppError("Ruta del documento de autorización no configurada", ERROR_CODES.INTERNAL_ERROR, 500);
        }
        const rutaAbsoluta = path.isAbsolute(ruta) ? ruta : path.resolve(process.cwd(), ruta);
        try {
            return await readFile(rutaAbsoluta, "utf-8");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            console.error("[AutorizacionProfesional] Error leyendo documento legal:", msg);
            throw new AppError("Documento de autorización no disponible", ERROR_CODES.INTERNAL_ERROR, 500);
        }
    }

    calcularHash(contenido: string): string {
        return createHash("sha256").update(contenido, "utf-8").digest("hex");
    }

    /** La última aceptación del profesional (la vigente), o null. */
    aceptacionVigente(usuarioId: string): Promise<AceptacionAutorizacionProfesional | null> {
        return this.repo.buscarUltima(usuarioId);
    }

    /** ¿Ya aceptó la versión vigente del texto? */
    async yaAceptoVersionVigente(usuarioId: string): Promise<boolean> {
        const [ultima, version] = await Promise.all([this.repo.buscarUltima(usuarioId), this.versionVigente()]);
        return ultima?.version === version;
    }

    /** Tipo de la versión vigente (default FONDO — forzar es lo seguro). */
    async tipoVersionVigente(): Promise<TipoVersionAutorizacion> {
        const tipo = await getParametroSistemaValor(CLAVE_TIPO_AUTORIZACION);
        return tipo === "MENOR" ? "MENOR" : "FONDO";
    }

    /**
     * SPEC-686 · ¿la guardia debe llevar al profesional a (re)aceptar antes de operar?
     * FONDO (o primera versión): exige haber aceptado la versión VIGENTE — si aceptó una
     * anterior, la vuelve a aceptar. MENOR: solo si NUNCA aceptó nada (un cambio de redacción
     * no fuerza; la aceptación vieja sigue válida y Mi perfil muestra el aviso suave).
     */
    async necesitaAceptar(usuarioId: string): Promise<boolean> {
        const [version, tipo, ultima] = await Promise.all([
            this.versionVigente(),
            this.tipoVersionVigente(),
            this.repo.buscarUltima(usuarioId),
        ]);
        if (tipo === "MENOR") return ultima === null;
        return ultima?.version !== version;
    }

    /**
     * La aceptación que respalda la ANTERIORIDAD respecto de `fecha`: la última con
     * `aceptadoEn <= fecha`, o null si no había ninguna antes. Es lo que el verificador usa
     * para no revisar una verificación sin autorización previa.
     */
    aceptacionAntesDe(usuarioId: string, fecha: Date): Promise<AceptacionAutorizacionProfesional | null> {
        return this.repo.buscarUltimaAntesDe(usuarioId, fecha);
    }

    /**
     * Registra la aceptación: hashea el texto vigente y crea la fila inmutable con versión +
     * hash + fecha + IP + user-agent. Devuelve la aceptación y la versión aceptada.
     */
    async aceptar(input: AceptarAutorizacionInput): Promise<{ aceptacion: AceptacionAutorizacionProfesional; version: string }> {
        const version = await this.versionVigente();
        const documento = await this.obtenerDocumentoVigente();
        const documentoHash = this.calcularHash(documento);
        const aceptacion = await this.repo.crear({
            usuarioId: input.usuarioId,
            version,
            documentoHash,
            aceptadoEn: new Date(),
            ip: input.ip,
            userAgent: input.userAgent,
        });
        return { aceptacion, version };
    }
}

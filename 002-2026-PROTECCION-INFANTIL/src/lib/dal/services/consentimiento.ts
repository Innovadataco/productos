/**
 * SPEC-241 (002-PI-144): servicio de consentimiento informado.
 * Carga documentos legales parametrizados, calcula hash SHA256 y registra
 * la aceptación en AuditConsentimiento de forma inmutable.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RolUsuario } from "@prisma/client";
import { AppError, ERROR_CODES } from "../../errors";
import { getParametroSistemaValor } from "../../parametros";
import { programar } from "../../notificaciones";
import { withUnitOfWork } from "../unit-of-work";
import { UsuarioRepository } from "../repositories/usuario";
import { ConsentimientoRepository } from "../repositories/consentimiento";
import { formatInTimeZone } from "date-fns-tz";

export const TIPO_DOCUMENTO_CONSENTIMIENTO = {
    POLITICA_DATOS: "POLITICA_DATOS",
    CONVENIO_INSTITUCIONAL: "CONVENIO_INSTITUCIONAL",
} as const;

export type TipoDocumentoConsentimiento =
    (typeof TIPO_DOCUMENTO_CONSENTIMIENTO)[keyof typeof TIPO_DOCUMENTO_CONSENTIMIENTO];

const ROL_A_DOCUMENTO: Record<string, TipoDocumentoConsentimiento> = {
    PARENT: "POLITICA_DATOS",
    ADMIN: "POLITICA_DATOS",
    OPERADOR: "POLITICA_DATOS",
    COMITE_VALIDACION: "POLITICA_DATOS",
    COMITE_CONVIVENCIA: "CONVENIO_INSTITUCIONAL",
    SCHOOL_ADMIN: "CONVENIO_INSTITUCIONAL",
};

const TIMEZONE_BOGOTA = "America/Bogota";

export interface AceptarConsentimientoInput {
    usuarioId: string;
    rol: RolUsuario;
    documentoTipo: TipoDocumentoConsentimiento;
    esRepresentanteLegal: boolean;
    ip: string;
    userAgent: string | null;
}

export class ConsentimientoService {
    private readonly usuarioRepo: UsuarioRepository;
    private readonly consentimientoRepo: ConsentimientoRepository;

    constructor(tx?: import("../unit-of-work").DbClient) {
        this.usuarioRepo = new UsuarioRepository(tx);
        this.consentimientoRepo = new ConsentimientoRepository(tx);
    }

    /**
     * Retorna la versión vigente del consentimiento desde ParametroSistema.
     */
    async versionVigente(): Promise<string> {
        const version = await getParametroSistemaValor("consentimiento.version_actual");
        if (!version) {
            throw new AppError("Versión de consentimiento no configurada", ERROR_CODES.INTERNAL_ERROR, 500);
        }
        return version;
    }

    /**
     * Indica si el usuario ya aceptó la versión vigente del consentimiento.
     */
    async versionEstaActual(usuarioId: string): Promise<boolean> {
        const [usuario, versionActual] = await Promise.all([
            this.usuarioRepo.findConConsentimiento(usuarioId),
            this.versionVigente(),
        ]);
        if (!usuario) return false;
        return usuario.consentimientoVersion === versionActual;
    }

    /**
     * Resuelve el tipo de documento por defecto para un rol.
     */
    documentoPorRol(rol: RolUsuario): TipoDocumentoConsentimiento {
        return ROL_A_DOCUMENTO[rol] ?? "POLITICA_DATOS";
    }

    /**
     * Lee el documento legal vigente según el tipo desde la ruta parametrizada.
     */
    async obtenerDocumentoVigente(documentoTipo: TipoDocumentoConsentimiento): Promise<string> {
        const claveRuta =
            documentoTipo === "CONVENIO_INSTITUCIONAL"
                ? "consentimiento.colegio.documento_ruta"
                : "consentimiento.padre.documento_ruta";

        const ruta = await getParametroSistemaValor(claveRuta);
        if (!ruta) {
            throw new AppError("Ruta del documento legal no configurada", ERROR_CODES.INTERNAL_ERROR, 500);
        }

        const rutaAbsoluta = path.isAbsolute(ruta) ? ruta : path.resolve(process.cwd(), ruta);
        try {
            return await readFile(rutaAbsoluta, "utf-8");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            console.error("[Consentimiento] Error leyendo documento legal:", msg);
            throw new AppError("Documento legal no disponible", ERROR_CODES.INTERNAL_ERROR, 500);
        }
    }

    /**
     * Calcula el hash SHA256 de un contenido.
     */
    calcularHash(contenido: string): string {
        return createHash("sha256").update(contenido, "utf-8").digest("hex");
    }

    /**
     * Registra la aceptación del consentimiento: hash del documento, fila en
     * AuditConsentimiento, actualización de Usuario y notificación al usuario.
     * Ejecuta dentro de una transacción si no se provee una unidad de trabajo activa.
     */
    async aceptar(input: AceptarConsentimientoInput) {
        const versionActual = await this.versionVigente();
        const documentoContenido = await this.obtenerDocumentoVigente(input.documentoTipo);
        const documentoHash = this.calcularHash(documentoContenido);
        const aceptadoEn = new Date();

        const ejecutar = async (tx: import("@prisma/client").Prisma.TransactionClient) => {
            const repoUsuario = new UsuarioRepository(tx);
            const repoConsentimiento = new ConsentimientoRepository(tx);

            const audit = await repoConsentimiento.crear({
                usuarioId: input.usuarioId,
                version: versionActual,
                documentoTipo: input.documentoTipo,
                documentoHash,
                aceptadoEn,
                ip: input.ip,
                userAgent: input.userAgent,
                esRepresentanteLegal: input.esRepresentanteLegal,
            });

            const usuario = await repoUsuario.actualizarConsentimiento(input.usuarioId, {
                consentimientoAceptadoEn: aceptadoEn,
                consentimientoVersion: versionActual,
                consentimientoDocumentoHash: documentoHash,
                consentimientoIP: input.ip,
            });

            return { audit, usuario };
        };

        const resultado = await withUnitOfWork(ejecutar);

        // Notificación al usuario (best-effort; no falla la aceptación).
        try {
            const fechaBogota = formatInTimeZone(aceptadoEn, TIMEZONE_BOGOTA, "yyyy-MM-dd HH:mm");
            await programar({
                evento: "consentimiento.aceptado",
                sujetoTipo: "usuario",
                sujetoId: input.usuarioId,
                destinatarios: [
                    {
                        usuarioId: input.usuarioId,
                        variables: {
                            nombreUsuario: resultado.usuario.nombre ?? "Usuario",
                            version: versionActual,
                            fechaAceptacion: fechaBogota,
                            urlDashboard: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5005"}/dashboard`,
                        },
                    },
                ],
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            console.error("[Consentimiento] Error programando notificación:", msg);
        }

        return { ...resultado, version: versionActual };
    }
}

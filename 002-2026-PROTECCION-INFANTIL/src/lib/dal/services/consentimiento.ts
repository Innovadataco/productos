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

// SPEC-953: la puerta de consentimiento del colegio sirve la AUTORIZACIÓN de
// tratamiento (POLITICA_DATOS) — un acto unilateral del titular, igual que el
// del padre/admin/operador/comité de validación. Antes servía
// CONVENIO_INSTITUCIONAL, un CONTRATO BILATERAL (Encargado↔Responsable) con
// placeholders de parte y firma de dos partes, que se "aceptaba" en el gate
// ANTES de identificar al firmante (ciudad/dirección/representante aún sin
// capturar). Instrumento equivocado para un click-wrap de registro.
// El tipo CONVENIO_INSTITUCIONAL y su .md QUEDAN definidos (instrumento formal
// aparte, pendiente del abogado); solo dejan de estar cableados a este gate.
const ROL_A_DOCUMENTO: Record<string, TipoDocumentoConsentimiento> = {
    PARENT: "POLITICA_DATOS",
    ADMIN: "POLITICA_DATOS",
    OPERADOR: "POLITICA_DATOS",
    COMITE_VALIDACION: "POLITICA_DATOS",
    COMITE_CONVIVENCIA: "POLITICA_DATOS",
    SCHOOL_ADMIN: "POLITICA_DATOS",
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

        // SPEC-966: ruta del documento legal (parámetro) resuelta en runtime → el tracer
        // de next trazaba el proyecto entero. El .md lo EMBARCA el Dockerfile (COPY).
        const rutaAbsoluta = path.isAbsolute(ruta) ? ruta : path.resolve(/*turbopackIgnore: true*/ process.cwd(), ruta);
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

            // SPEC-955: ¿es la PRIMERA aceptación del usuario? Se mide DENTRO de la
            // transacción, ANTES de crear la fila, para que el bifurcado del correo
            // (bienvenida fusionada del colegio vs recibo genérico) sea atómico y no
            // dependa de un conteo posterior sujeto a carreras.
            const aceptacionesPrevias = await repoConsentimiento.findByUsuarioId(input.usuarioId);
            const esPrimeraAceptacion = aceptacionesPrevias.length === 0;

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

            return { audit, usuario, esPrimeraAceptacion };
        };

        const resultado = await withUnitOfWork(ejecutar);

        // Notificación al usuario (best-effort; no falla la aceptación).
        //
        // SPEC-962 · BIFURCACIÓN por rol del aceptante:
        //  - SCHOOL_ADMIN en su PRIMERA aceptación → NO se manda nada acá. El correo de
        //    bienvenida del rector (`colegio.bienvenida_rector`) salía en este punto
        //    (SPEC-955), con el camino aún en el Paso 1; ahora lo dispara el CIERRE del
        //    camino (completarCaminoColegio). Tampoco cae al recibo genérico
        //    `consentimiento.aceptado`: el motor NO filtra por rol (SPEC-247), así que
        //    SÍ llegaría al rector si cayera en el else — por eso el branch es explícito.
        //  - cualquier otro caso (otros roles, o un colegio RE-aceptando por un bump de
        //    versión) → el recibo genérico `consentimiento.aceptado` COMPARTIDO, sin
        //    cambio (no se reescribe esa plantilla: rompería a los padres, SPEC-247).
        try {
            if (input.rol === "SCHOOL_ADMIN" && resultado.esPrimeraAceptacion) {
                // SPEC-962: sin aviso al aceptar; la bienvenida del colegio nace del
                // cierre del camino. La aceptación ya quedó registrada arriba.
            } else {
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
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            console.error("[Consentimiento] Error programando notificación:", msg);
        }

        return { ...resultado, version: versionActual };
    }
}

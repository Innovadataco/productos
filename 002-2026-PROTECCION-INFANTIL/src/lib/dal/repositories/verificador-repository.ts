/**
 * SPEC-408 (A-75 · brief §9) — Repositorio del Verificador.
 * Q-3: el service del verificador (`src/lib/profesionales/verificador/service.ts`
 * y `vista-profesional.ts`) NO habla con Prisma directo; entra y sale por acá.
 *
 * Encapsula exactamente lo que el Verificador y el Profesional necesitan leer
 * y escribir sobre `PerfilProfesional` + `VerificacionProfesional`. Los
 * candados legales (H-2: `resultado`/`checklist`/`notaInterna`/`autorizacionArchivoId`
 * nunca al padre) viven en los mapeos del service, no acá — este repo devuelve
 * el shape crudo con los includes necesarios.
 */
import type {
    EstadoPerfilProfesional,
    Prisma,
    ResultadoVerificacion,
} from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";
import { whereExcluirPerfilesSembrados } from "../demo-exclusion";

const INCLUDE_COLA = {
    usuario: { select: { email: true } },
    ciudad: { select: { nombre: true } },
    verificaciones: { select: { id: true } },
} as const;

const INCLUDE_FICHA = {
    usuario: { select: { email: true, nombre: true } },
    ciudad: { select: { nombre: true } },
    verificaciones: {
        orderBy: { revisadoEn: "desc" as const },
        include: { revisadoPor: { select: { email: true } } },
    },
} as const;

const INCLUDE_INCIDENTES = {
    profesional: { include: { usuario: { select: { email: true, nombre: true } } } },
    padreUsuario: { select: { email: true, nombre: true } },
} as const;

export class VerificadorRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Cola de perfiles en revisión, más viejos primero (más esperan, más urgen).
     * I-419: EXCLUYE los perfiles SEMBRADOS (demo) — el visor es un verificador real y un
     * profesional de prueba no es una solicitud real. Mismo predicado que SPEC-655.
     */
    async listarPerfilesEnRevision() {
        return this.db.perfilProfesional.findMany({
            where: { estado: "EN_REVISION", ...(await whereExcluirPerfilesSembrados(this.db)) },
            orderBy: { actualizadoEn: "asc" },
            include: INCLUDE_COLA,
        });
    }

    /** Ficha: perfil + usuario + ciudad + historial de verificaciones (desc). */
    obtenerFicha(id: string) {
        return this.db.perfilProfesional.findUnique({
            where: { id },
            include: INCLUDE_FICHA,
        });
    }

    findPorUsuarioId(usuarioId: string) {
        return this.db.perfilProfesional.findUnique({
            where: { usuarioId },
            include: {
                verificaciones: { orderBy: { revisadoEn: "desc" as const }, take: 1 },
            },
        });
    }

    /**
     * SPEC-449 (I-313) · lo que el reloj de vencimiento necesita leer.
     *
     * Trae los perfiles que PUEDEN vencer —`ACTIVO`— con sus verificaciones, en
     * la forma exacta que consume `decidirAcciones` (`cron-vencimiento.ts:56`),
     * que hasta esta spec no tenía quién lo alimentara: era lógica escrita,
     * probada y sin una sola consulta detrás.
     *
     * Solo `ACTIVO` porque es el único estado desde el que `MARCAR_VENCIDO`
     * tiene sentido; los demás ya están fuera del directorio.
     */
    async perfilesParaCorridaDeVencimiento(): Promise<
        Array<{
            id: string;
            estado: EstadoPerfilProfesional;
            verificaciones: Array<{
                id: string;
                perfilProfesionalId: string;
                resultado: ResultadoVerificacion;
                revisadoEn: Date;
                venceEn: Date;
                avisoVencimientoEnviadoEn: Date | null;
            }>;
        }>
        > {
        return this.db.perfilProfesional.findMany({
            where: { estado: "ACTIVO" },
            select: {
                id: true,
                estado: true,
                verificaciones: {
                    select: {
                        id: true,
                        perfilProfesionalId: true,
                        resultado: true,
                        revisadoEn: true,
                        venceEn: true,
                        avisoVencimientoEnviadoEn: true,
                    },
                },
            },
        });
    }

    /**
     * SPEC-449 · marca el perfil `VENCIDO` **solo si sigue `ACTIVO`** (CAS).
     * Devuelve `false` si otra corrida ya lo transitó — dos corridas
     * simultáneas no pueden escribir dos veces ni pisarse.
     */
    async marcarVencidoSiActivo(perfilProfesionalId: string): Promise<boolean> {
        const r = await this.db.perfilProfesional.updateMany({
            where: { id: perfilProfesionalId, estado: "ACTIVO" },
            data: { estado: "VENCIDO" },
        });
        return r.count > 0;
    }

    /**
     * SPEC-449 · sella el aviso **solo si no se envió antes** (CAS).
     * Es lo que impide que la corrida de mañana repita el correo de hoy.
     */
    async marcarAvisoVencimientoEnviado(verificacionId: string, cuando: Date): Promise<boolean> {
        const r = await this.db.verificacionProfesional.updateMany({
            where: { id: verificacionId, avisoVencimientoEnviadoEn: null },
            data: { avisoVencimientoEnviadoEn: cuando },
        });
        return r.count > 0;
    }

    /** Cambia el estado del perfil (solo transiciones válidas en el service). */
    cambiarEstadoPerfil(id: string, estado: EstadoPerfilProfesional, tx?: Prisma.TransactionClient) {
        const client = tx ?? this.db;
        return client.perfilProfesional.update({ where: { id }, data: { estado } });
    }

    /** Crea la fila de verificación (aprobada o devuelta) en el historial. */
    crearVerificacion(
        params: {
            perfilProfesionalId: string;
            revisadoPorId: string;
            revisadoEn: Date;
            checklist: Prisma.InputJsonValue;
            resultado: ResultadoVerificacion;
            // SPEC-686: la autorización que respaldó la revisión — el archivo LEGACY o la
            // ACEPTACIÓN en pantalla. Al menos una; el service exige anterioridad de la aceptación.
            autorizacionArchivoId: string | null;
            aceptacionAutorizacionId: string | null;
            venceEn: Date;
            notaInterna: string;
        },
        tx?: Prisma.TransactionClient,
    ) {
        const client = tx ?? this.db;
        return client.verificacionProfesional.create({
            data: {
                perfilProfesionalId: params.perfilProfesionalId,
                revisadoPorId: params.revisadoPorId,
                revisadoEn: params.revisadoEn,
                checklist: params.checklist,
                resultado: params.resultado,
                autorizacionArchivoId: params.autorizacionArchivoId,
                aceptacionAutorizacionId: params.aceptacionAutorizacionId,
                venceEn: params.venceEn,
                notaInterna: params.notaInterna,
            },
        });
    }

    /**
     * SPEC-693 (I-416): fija en la tabla de unión QUÉ versiones de documento revisó
     * una verificación (los bytes exactos, vía `DocumentoProfesional.sha256`). El
     * `@@unique(verificacionId, documentoProfesionalId)` hace idempotente el registro.
     * Correr dentro de la transacción de la decisión.
     */
    async registrarDocumentosRevisados(verificacionId: string, documentoProfesionalIds: string[]) {
        if (documentoProfesionalIds.length === 0) return;
        await this.db.verificacionDocumento.createMany({
            data: documentoProfesionalIds.map((documentoProfesionalId) => ({
                verificacionId,
                documentoProfesionalId,
            })),
            skipDuplicates: true,
        });
    }

    /**
     * SPEC-693 (I-416) · cola 3 «Documentos nuevos»: profesionales ACTIVOS (aprobados,
     * ATENDIENDO) que subieron una versión nueva de algún requisito — un documento
     * EN_REVISION que CONVIVE con el vigente. Es la renovación por requisito: el
     * profesional sigue atendiendo con el anterior. Solo ACTIVO: un perfil en revisión
     * inicial es carril de `decidir`, y uno vencido recupera vigencia por re-verificación
     * completa, no por renovar un requisito (renovar NUNCA mueve la vigencia). Trae los
     * documentos ACTUALES (vigente + pendiente) para pintarlos lado a lado, y la última
     * verificación APROBADA para `venceEn` (la franja ámbar de ≤30 días la calcula la vista).
     */
    async listarRenovacionesPendientes() {
        return this.db.perfilProfesional.findMany({
            where: {
                estado: "ACTIVO",
                documentos: { some: { estado: "EN_REVISION" } },
                // I-419: fuera los sembrados (mismo predicado que la cola de solicitudes).
                ...(await whereExcluirPerfilesSembrados(this.db)),
            },
            orderBy: { actualizadoEn: "asc" },
            include: {
                usuario: { select: { email: true } },
                ciudad: { select: { nombre: true } },
                documentos: {
                    where: { estado: { in: ["VIGENTE", "EN_REVISION"] } },
                    orderBy: [{ requisitoClave: "asc" }, { estado: "asc" }],
                },
                verificaciones: {
                    where: { resultado: "APROBADO" },
                    orderBy: { revisadoEn: "desc" },
                    take: 1,
                    select: { venceEn: true },
                },
            },
        });
    }

    /** Cola 2 — citas en SIN_CONFIRMAR con las dos puntas (padre + profesional). */
    listarIncidentesSinConfirmar() {
        return this.db.solicitudCita.findMany({
            where: { estado: "SIN_CONFIRMAR" },
            orderBy: { actualizadoEn: "desc" },
            include: INCLUDE_INCIDENTES,
        });
    }

    /** $transaction pass-through para que el service componga sin importar prisma. */
    transaccion<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return prisma.$transaction(fn);
    }
}

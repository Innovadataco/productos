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

    /** Cola de perfiles en revisión, más viejos primero (más esperan, más urgen). */
    listarPerfilesEnRevision() {
        return this.db.perfilProfesional.findMany({
            where: { estado: "EN_REVISION" },
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
            autorizacionArchivoId: string;
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
                venceEn: params.venceEn,
                notaInterna: params.notaInterna,
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

/**
 * SPEC-134 (E-1): repositorio de Colegio — tenant obligatorio por construcción.
 * Excepción documentada del diseño tenant-first: aquí el tenant ES el propio id
 * del colegio (regla 4 del plan). Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_VIGENCIA = {
    id: true,
    estado: true,
    inicioServicio: true,
    finServicio: true,
} satisfies Prisma.ColegioSelect;

const SELECT_RESUMEN = {
    id: true,
    nombre: true,
} satisfies Prisma.ColegioSelect;

const SELECT_FICHA_HOME = {
    id: true,
    nombre: true,
    finServicio: true,
} satisfies Prisma.ColegioSelect;

const INCLUDE_UBICACION = {
    pais: { select: { id: true, nombre: true } },
    departamento: { select: { id: true, nombre: true } },
    ciudad: { select: { id: true, nombre: true } },
} satisfies Prisma.ColegioInclude;

export type ColegioVigenciaRow = Prisma.ColegioGetPayload<{ select: typeof SELECT_VIGENCIA }>;
export type ColegioResumenRow = Prisma.ColegioGetPayload<{ select: typeof SELECT_RESUMEN }>;
export type ColegioFichaHomeRow = Prisma.ColegioGetPayload<{ select: typeof SELECT_FICHA_HOME }>;
export type ColegioConUbicacion = Prisma.ColegioGetPayload<{ include: typeof INCLUDE_UBICACION }>;

export class ColegioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Ventana de servicio del colegio (vigencia.ts). Null si no existe. */
    obtenerVigencia(colegioId: string): Promise<ColegioVigenciaRow | null> {
        return this.db.colegio.findUnique({
            where: { id: colegioId },
            select: SELECT_VIGENCIA,
        });
    }

    /** Resumen mínimo para estadísticas (id + nombre). Null si no existe. */
    obtenerResumen(colegioId: string): Promise<ColegioResumenRow | null> {
        return this.db.colegio.findUnique({
            where: { id: colegioId },
            select: SELECT_RESUMEN,
        });
    }

    /** SPEC-143: ficha de la home del rector (nombre + fin de vigencia). Null si no existe. */
    obtenerFichaHome(colegioId: string): Promise<ColegioFichaHomeRow | null> {
        return this.db.colegio.findUnique({
            where: { id: colegioId },
            select: SELECT_FICHA_HOME,
        });
    }

    /**
     * SPEC-149 (FR-005): ids de los colegios activos y vigentes en `ahora`
     * (destinatarios del resumen semanal). Excepción cross-tenant documentada:
     * el schedule corre para TODOS los colegios (como listarAdminGlobal).
     */
    listarIdsActivosVigentes(ahora: Date): Promise<{ id: string }[]> {
        return this.db.colegio.findMany({
            where: {
                estado: "activo",
                OR: [{ finServicio: null }, { finServicio: { gt: ahora } }],
            },
            select: { id: true },
        });
    }

    /** Colegio con su ubicación (GET /api/me/colegio). Null si no existe. */
    obtenerConUbicacion(colegioId: string): Promise<ColegioConUbicacion | null> {
        return this.db.colegio.findUnique({
            where: { id: colegioId },
            include: INCLUDE_UBICACION,
        });
    }

    // ── Funciones ADMIN globales (gestión de colegios de la plataforma) ──
    // Excepción documentada: estas lecturas/escrituras cruzan todos los tenants
    // porque las usa el rol ADMIN de plataforma, no un tenant.

    /** E-8 (admin global): lista de colegios no eliminados con ubicación, admin y tenant. */
    listarAdminGlobal() {
        return this.db.colegio.findMany({
            where: { estado: { not: "eliminado" } },
            include: {
                pais: { select: { id: true, nombre: true } },
                departamento: { select: { id: true, nombre: true } },
                ciudad: { select: { id: true, nombre: true } },
                admin: { select: { id: true, email: true, nombre: true, estado: true } },
                tenant: { select: { id: true, nombre: true } },
            },
            orderBy: { creadoEn: "desc" },
        });
    }

    /** E-8 (admin global): colegio con email del admin (PATCH de datos/vigencia). */
    findParaActualizar(id: string) {
        return this.db.colegio.findUnique({
            where: { id },
            include: { admin: { select: { id: true, email: true } } },
        });
    }

    /** E-8 (admin global): colegio con el id del admin (DELETE — baja en cascada). */
    findParaEliminar(id: string) {
        return this.db.colegio.findUnique({
            where: { id },
            include: { admin: { select: { id: true } } },
        });
    }

    /** E-8 (admin global): colegio con credenciales del admin (regenerar password). */
    findParaRegenerarPassword(id: string) {
        return this.db.colegio.findUnique({
            where: { id },
            include: { admin: { select: { id: true, email: true, nombre: true, estado: true, debeCambiarPassword: true } } },
        });
    }

    /** E-8 (admin global): colegio con el contacto del admin (reenvío de email). */
    findParaReenviarEmail(id: string) {
        return this.db.colegio.findUnique({
            where: { id },
            include: { admin: { select: { id: true, email: true, nombre: true } } },
        });
    }

    /** E-8 (admin global): alta del tenant del colegio (misma tx que el colegio). */
    crearTenantParaColegio(nombreColegio: string) {
        return this.db.tenant.create({
            data: { nombre: `Colegio: ${nombreColegio}`, estado: "activo" },
        });
    }

    /** E-8 (admin global): alta del colegio (dentro de la tx de creación). */
    crear(data: Prisma.ColegioUncheckedCreateInput) {
        return this.db.colegio.create({ data });
    }

    /** SPEC-320 (§2.2-bis): colegio por NIT (único global). Null si no existe. */
    buscarPorNit(nit: string) {
        return this.db.colegio.findUnique({ where: { nit } });
    }

    /**
     * SPEC-240 (002-PI-143): alta de colegio con datos mínimos (registro público o
     * pre-registro admin). Los valores por defecto (ubicación, representante legal,
     * inicio de servicio) los resuelve el servicio; este método solo materializa.
     */
    crearMinimo(data: Prisma.ColegioUncheckedCreateInput) {
        return this.db.colegio.create({ data });
    }

    /** E-8 (admin global): actualización de datos/vigencia/estado del colegio. */
    actualizar(id: string, data: Prisma.ColegioUncheckedUpdateInput) {
        return this.db.colegio.update({ where: { id }, data });
    }
}

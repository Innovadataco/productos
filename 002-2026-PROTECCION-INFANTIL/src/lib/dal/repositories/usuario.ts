/**
 * SPEC-053 (data-model §1.4): repositorio de Usuario.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class UsuarioRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByEmail(email: string) {
        return this.db.usuario.findUnique({ where: { email } });
    }

    findById(id: string) {
        return this.db.usuario.findUnique({ where: { id } });
    }

    crear(data: Prisma.UsuarioUncheckedCreateInput) {
        return this.db.usuario.create({ data });
    }

    actualizar(id: string, data: Prisma.UsuarioUncheckedUpdateInput) {
        return this.db.usuario.update({ where: { id }, data });
    }

    /** Operadores/comité con su perfil (filtro tenant opcional). */
    findOperadores(where: Prisma.UsuarioWhereInput) {
        return this.db.usuario.findMany({
            where,
            include: { perfilOperador: true },
            orderBy: { creadoEn: "desc" },
        });
    }

    /** Un operador o miembro del comité por id, con su perfil. */
    findOperadorById(id: string) {
        return this.db.usuario.findFirst({
            where: { id, rol: { in: ["OPERADOR", "COMITE_VALIDACION"] } },
            include: { perfilOperador: true },
        });
    }

    /** Alta de operador/comité con perfil anidado. */
    crearConPerfil(data: Prisma.UsuarioUncheckedCreateInput) {
        return this.db.usuario.create({ data, include: { perfilOperador: true } });
    }

    /** Recarga con perfil (respuesta de PATCH). */
    findByIdConPerfil(id: string) {
        return this.db.usuario.findUnique({ where: { id }, include: { perfilOperador: true } });
    }

    /** Operadores activos para el panel de asignación (cupo y revisión de apelaciones). */
    findOperadoresActivosAsignacion() {
        return this.db.usuario.findMany({
            where: { rol: "OPERADOR", estado: "activo" },
            include: { perfilOperador: { select: { cupoMaximo: true, esRevisorDeApelaciones: true } } },
            orderBy: { creadoEn: "asc" },
        });
    }

    /** Email/nombre por ids (leyenda de métricas por operador). */
    findInfoPorIds(ids: string[]) {
        return this.db.usuario.findMany({
            where: { id: { in: ids } },
            select: { id: true, email: true, nombre: true },
        });
    }

    /** E-8: operador activo con su cupo (reasignación de casos). */
    findOperadorActivoConCupo(id: string) {
        return this.db.usuario.findFirst({
            where: { id, rol: "OPERADOR", estado: "activo" },
            include: { perfilOperador: { select: { cupoMaximo: true } } },
        });
    }

    /** Miembro activo del comité de validación con su flag esComite (asignar/reasignar). */
    findMiembroComiteActivo(id: string) {
        return this.db.usuario.findFirst({
            where: { id, rol: "COMITE_VALIDACION", estado: "activo" },
            include: { perfilOperador: { select: { esComite: true } } },
        });
    }

    /** SPEC-134 (E-1): rol + colegio + ventana propia (vigencia de clientes, SPEC-119).
     *  SPEC-168: incluye comiteColegioId para vigencia del Comité de Convivencia.
     */
    findVigenciaCliente(id: string) {
        return this.db.usuario.findUnique({
            where: { id },
            select: { rol: true, colegioId: true, comiteColegioId: true, inicioServicio: true, finServicio: true },
        });
    }

    /** SPEC-134 (E-1): solo el colegioId (verificación de propiedad del módulo colegio). */
    findColegioId(id: string) {
        return this.db.usuario.findUnique({
            where: { id },
            select: { colegioId: true },
        });
    }

    /** SPEC-166: usuarios asignables dentro del colegio (SCHOOL_ADMIN / OPERADOR activos). */
    findAsignablesPorColegio(colegioId: string) {
        return this.db.usuario.findMany({
            where: {
                colegioId,
                rol: { in: ["SCHOOL_ADMIN", "OPERADOR"] },
                estado: "activo",
            },
            select: { id: true, nombre: true, email: true, rol: true },
            orderBy: { nombre: "asc" },
        });
    }

    /** SPEC-134 (E-1): SCHOOL_ADMIN activo del colegio para la notificación ciega de alertas. */
    findAdminColegioParaNotificacion(colegioId: string) {
        return this.db.usuario.findFirst({
            where: { colegioId, rol: "SCHOOL_ADMIN", estado: "activo" },
            select: { id: true, email: true, ultimaNotificacionColegioEn: true },
        });
    }

    /** SPEC-134 (E-1): marca el cooldown de la notificación ciega de alertas del colegio. */
    marcarNotificacionColegioEn(id: string, fecha: Date) {
        return this.db.usuario.update({
            where: { id },
            data: { ultimaNotificacionColegioEn: fecha },
        });
    }

    /** E-8: listado admin de cuentas PARENT (soporte de credenciales): items + total. */
    findPadresPaginados(
        where: Prisma.UsuarioWhereInput,
        paginacion: { skip: number; take: number }
    ) {
        const select = {
            id: true,
            email: true,
            nombre: true,
            estado: true,
            debeCambiarPassword: true,
            creadoEn: true,
            ultimaSesion: true,
            // SPEC-119: ventana de servicio del cliente padre.
            inicioServicio: true,
            finServicio: true,
        } satisfies Prisma.UsuarioSelect;
        return Promise.all([
            this.db.usuario.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select,
            }),
            this.db.usuario.count({ where }),
        ]);
    }

    /** SPEC-194 (002-PI-088): listado admin de usuarios por rol (empieza por PARENT). */
    findUsuariosAdminPaginados(
        where: Prisma.UsuarioWhereInput,
        paginacion: { skip: number; take: number }
    ) {
        const select = {
            id: true,
            email: true,
            nombre: true,
            estado: true,
            creadoEn: true,
            ultimaSesion: true,
            colegioId: true,
            tenantId: true,
            colegio: { select: { id: true, nombre: true } },
        } satisfies Prisma.UsuarioSelect;
        return Promise.all([
            this.db.usuario.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                select,
            }),
            this.db.usuario.count({ where }),
        ]);
    }

    /** E-8: cuenta PARENT para gestión admin (desactivar/reactivar/restablecer). */
    findPadreById(id: string) {
        return this.db.usuario.findFirst({
            where: { id, rol: "PARENT" },
            select: { id: true, email: true, nombre: true, estado: true, debeCambiarPassword: true },
        });
    }

    /** E-8: ventana de servicio de una cuenta PARENT (gestión de vigencia, SPEC-119). */
    findPadreVigencia(id: string) {
        return this.db.usuario.findFirst({
            where: { id, rol: "PARENT" },
            select: { id: true, email: true, inicioServicio: true, finServicio: true },
        });
    }

    /** E-8: fija/limpia la ventana de servicio y devuelve la cuenta actualizada. */
    actualizarVigenciaServicio(id: string, data: { inicioServicio: Date | null; finServicio: Date | null }) {
        return this.db.usuario.update({
            where: { id },
            data,
            select: { id: true, email: true, inicioServicio: true, finServicio: true },
        });
    }

    /** E-8: flag de contraseña temporal (layout admin — enforcement central). */
    findDebeCambiarPassword(id: string) {
        return this.db.usuario.findUnique({
            where: { id },
            select: { debeCambiarPassword: true },
        });
    }

    /** E-8: sesión del panel colegio (layout colegio: rol/estado/colegio/flag password). */
    findSesionColegio(id: string) {
        return this.db.usuario.findUnique({
            where: { id },
            // SPEC-143: + nombre (aditivo) para el saludo de la home del rector.
            select: { id: true, nombre: true, rol: true, colegioId: true, estado: true, debeCambiarPassword: true },
        });
    }

    /** SPEC-168: sesión del Comité de Convivencia (rol/colegio/flag password). */
    findSesionComite(id: string) {
        return this.db.usuario.findUnique({
            where: { id },
            select: { id: true, nombre: true, rol: true, comiteColegioId: true, estado: true, debeCambiarPassword: true },
        });
    }

    /** E-8: usuario con su colegio y ubicación completa (home del panel colegio). */
    findConColegioYUbicacion(id: string) {
        return this.db.usuario.findUnique({
            where: { id },
            include: { colegio: { include: { pais: true, departamento: true, ciudad: true } } },
        });
    }

    /** E-8: operadores activos con perfil y cupo (asignador; filtro tenant opcional). */
    findOperadoresActivosConPerfil(tenantId?: string) {
        return this.db.usuario.findMany({
            where: {
                rol: "OPERADOR",
                estado: "activo",
                perfilOperador: { isNot: null },
                ...(tenantId ? { tenantId } : {}),
            },
            include: { perfilOperador: { select: { cupoMaximo: true } } },
        });
    }

    /** E-8: primer miembro activo del comité con su perfil completo (notificación). */
    findPrimerComiteActivoConPerfil() {
        return this.db.usuario.findFirst({
            where: { rol: "COMITE_VALIDACION", estado: "activo" },
            include: { perfilOperador: true },
        });
    }
}

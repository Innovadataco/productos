/**
 * SPEC-224 (002-PI-125): servicio del panel de reglas configurables. Orquesta
 * validación estática de SQL (FR-006), test en solo lectura (FR-007),
 * versionado con historial (FR-010/FR-011) y promoción de modo (FR-009) sobre
 * los repositorios DAL (frontera Q-3: aquí no hay Prisma directo).
 *
 * Invariantes:
 * - `clave` única e inmutable: POST con clave existente → 409; PATCH con
 *   clave distinta → 400 (FR-005).
 * - `modo` solo cambia por el endpoint dedicado con confirmación fuerte (D-77).
 * - El test SQL se ejecuta contra la BD real en transacción READ ONLY +
 *   statement_timeout acotado; su AuditLog (REGLA_SQL_TEST) guarda solo
 *   metadatos (huella, duración, filas de muestra), nunca filas ni textos.
 */
import type { Prisma, ReglaRecomendacion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { validarSqlReglaPanel } from "@/lib/analisis/reglas/validar-sql";
import {
    acotarMaxFilas,
    acotarTimeoutMs,
    envolverConLimit,
    extraerColumnas,
    huellaQuery,
    mensajeErrorPg,
} from "@/lib/analisis/reglas/test-sql";
import { construirSnapshot, diffCampos } from "@/lib/analisis/reglas/versionado";
import type {
    ItemHistorialRegla,
    ReglaDetalle,
    ReglaListItem,
    ResultadoCambioModo,
    ResultadoTestSql,
} from "@/lib/analisis/reglas/types";
import type {
    CambiarModoBody,
    CrearReglaBody,
    EditarReglaBody,
    ListaReglasQuery,
    TestSqlBody,
} from "@/lib/schemas/analisis-reglas";
import { ParametroRepository } from "../repositories/parametro";
import { ReglasRecomendacionRepository } from "../repositories/reglas-recomendacion";
import {
    ReglasAdminRepository,
    type ContextoAudit,
    type HistorialConAdmin,
} from "../repositories/reglas-admin-repository";

const CLAVE_TIMEOUT_TEST = "analisis.reglas.test_timeout_ms";
const CLAVE_MAX_FILAS_TEST = "analisis.reglas.test_max_filas";

interface Paginacion {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

function paginacion(page: number, pageSize: number, total: number): Paginacion {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

function aListItem(regla: ReglaRecomendacion, conteo7d: number): ReglaListItem {
    return {
        id: regla.id,
        clave: regla.clave,
        nombre: regla.nombre,
        categoria: regla.categoria,
        modo: regla.modo,
        frecuenciaMin: regla.frecuenciaMin,
        prioridad: regla.prioridad,
        activa: regla.activa,
        version: regla.version,
        recomendacionesGeneradas7d: conteo7d,
    };
}

function aDetalle(regla: ReglaRecomendacion, conteo7d: number): ReglaDetalle {
    return {
        ...aListItem(regla, conteo7d),
        descripcion: regla.descripcion,
        sqlQuery: regla.sqlQuery,
        plantillaRecomendacion: regla.plantillaRecomendacion,
        accionEjecutable: regla.accionEjecutable,
        accionParametros: regla.accionParametros,
        umbralMinimo: regla.umbralMinimo,
        creadaPorAdminId: regla.creadaPorAdminId,
        createdAt: regla.createdAt.toISOString(),
        updatedAt: regla.updatedAt.toISOString(),
        ultimaEvaluacionEn: regla.ultimaEvaluacionEn?.toISOString() ?? null,
    };
}

/** JSON del body (Zod record) → JSON seguro para Prisma (round-trip). */
function aJsonPrisma(valor: Record<string, unknown> | null): Prisma.InputJsonValue | null {
    if (valor === null) return null;
    return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

function assertSqlValido(sqlQuery: string): void {
    const validacion = validarSqlReglaPanel(sqlQuery);
    if (!validacion.ok) {
        throw new AppError(
            `Solo se permiten consultas SELECT de una sola sentencia: ${validacion.motivo}`,
            ERROR_CODES.VALIDATION_ERROR,
            400
        );
    }
}

function noEncontrado(): AppError {
    return new AppError("Regla no encontrada", ERROR_CODES.NOT_FOUND, 404);
}

export class ReglasAdminService {
    private readonly repo = new ReglasAdminRepository();
    private readonly params = new ParametroRepository();
    private readonly sandbox = new ReglasRecomendacionRepository();

    /** GET /api/admin/analisis/reglas — catálogo paginado + conteo 7d. */
    async listar(query: ListaReglasQuery): Promise<{ items: ReglaListItem[]; pagination: Paginacion }> {
        const where: Prisma.ReglaRecomendacionWhereInput = {};
        if (query.activa !== undefined) where.activa = query.activa === "true";
        if (query.q) {
            where.OR = [
                { nombre: { contains: query.q, mode: "insensitive" } },
                { clave: { contains: query.q, mode: "insensitive" } },
            ];
        }
        const { items, total } = await this.repo.listarPaginado(where, {
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
        });
        const hace7d = new Date(Date.now() - 7 * 86_400_000);
        const conteos = await this.repo.conteoUltimos7dPorRegla(items.map((r) => r.id), hace7d);
        return {
            items: items.map((r) => aListItem(r, conteos.get(r.id) ?? 0)),
            pagination: paginacion(query.page, query.pageSize, total),
        };
    }

    /** GET /api/admin/analisis/reglas/[id] — detalle completo + conteo 7d. */
    async obtenerDetalle(id: string): Promise<ReglaDetalle> {
        const regla = await this.repo.obtenerPorId(id);
        if (!regla) throw noEncontrado();
        const hace7d = new Date(Date.now() - 7 * 86_400_000);
        const conteos = await this.repo.conteoUltimos7dPorRegla([id], hace7d);
        return aDetalle(regla, conteos.get(id) ?? 0);
    }

    /** POST /api/admin/analisis/reglas — 409 si la clave ya existe (FR-005). */
    async crear(body: CrearReglaBody, audit: ContextoAudit): Promise<ReglaDetalle> {
        assertSqlValido(body.sqlQuery);
        const existente = await this.repo.obtenerPorClave(body.clave);
        if (existente) {
            throw new AppError("Ya existe una regla con esa clave", ERROR_CODES.CONFLICT, 409);
        }
        const regla = await this.repo.crearConAuditoria(
            {
                clave: body.clave,
                nombre: body.nombre,
                descripcion: body.descripcion,
                categoria: body.categoria,
                sqlQuery: body.sqlQuery,
                plantillaRecomendacion: body.plantillaRecomendacion,
                prioridad: body.prioridad,
                frecuenciaMin: body.frecuenciaMin,
                umbralMinimo: body.umbralMinimo,
                accionEjecutable: body.accionEjecutable,
                accionParametros: aJsonPrisma(body.accionParametros),
                creadaPorAdminId: audit.usuarioId,
            },
            audit
        );
        return aDetalle(regla, 0);
    }

    /**
     * PATCH /api/admin/analisis/reglas/[id] — edición con versionado (FR-010).
     * `modo` → 400 (usar /modo); `clave` distinta → 400 (inmutable, FR-005).
     */
    async actualizar(id: string, body: EditarReglaBody, audit: ContextoAudit): Promise<ReglaDetalle> {
        if (body.modo !== undefined) {
            throw new AppError(
                "El modo no es editable aquí: usa el endpoint de cambio de modo con confirmación",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }
        const regla = await this.repo.obtenerPorId(id);
        if (!regla) throw noEncontrado();
        if (body.clave !== undefined && body.clave !== regla.clave) {
            throw new AppError("La clave de una regla es inmutable", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (body.sqlQuery !== undefined) assertSqlValido(body.sqlQuery);

        const { motivo, clave: _clave, modo: _modo, ...cambios } = body;
        const cambiaActiva = cambios.activa !== undefined && cambios.activa !== regla.activa;
        const accion = cambiaActiva
            ? cambios.activa === true
                ? ("REGLA_ACTIVADA" as const)
                : ("REGLA_DESACTIVADA" as const)
            : ("REGLA_ACTUALIZADA" as const);

        const actualizada = await this.repo.actualizarConHistorial({
            reglaAnterior: regla,
            cambios: {
                ...cambios,
                accionParametros:
                    cambios.accionParametros === undefined ? undefined : aJsonPrisma(cambios.accionParametros),
            },
            motivo,
            accion,
            audit,
        });
        const hace7d = new Date(Date.now() - 7 * 86_400_000);
        const conteos = await this.repo.conteoUltimos7dPorRegla([id], hace7d);
        return aDetalle(actualizada, conteos.get(id) ?? 0);
    }

    /**
     * POST /api/admin/analisis/reglas/[id]/modo — promoción/reversión (FR-009).
     * 409 si ya está en el modo solicitado. Advertencias (contrato): regla
     * inactiva o EJECUTA sin acción ejecutable (se comporta como Recomienda).
     */
    async cambiarModo(id: string, body: CambiarModoBody, audit: ContextoAudit): Promise<ResultadoCambioModo> {
        const regla = await this.repo.obtenerPorId(id);
        if (!regla) throw noEncontrado();
        if (regla.modo === body.modo) {
            throw new AppError(`La regla ya está en modo ${body.modo}`, ERROR_CODES.CONFLICT, 409);
        }
        const actualizada = await this.repo.cambiarModoConAuditoria({
            regla,
            modo: body.modo,
            motivo: body.motivo,
            audit,
        });
        const advertencias: string[] = [];
        if (!actualizada.activa) advertencias.push("La regla está inactiva");
        if (actualizada.modo === "EJECUTA" && !actualizada.accionEjecutable) {
            advertencias.push("Sin acción ejecutable configurada: se comporta como Recomienda");
        }
        return { id: actualizada.id, modo: actualizada.modo, advertencia: advertencias.join(" · ") || null };
    }

    /**
     * GET /api/admin/analisis/reglas/[id]/historial — versiones desc con diff
     * legible. El `camposCambiados` de la versión N es el diff entre su
     * snapshot y el estado que la reemplazó: el snapshot N+1 (o la regla
     * actual para la versión más reciente). En páginas > 1 el snapshot N+1 de
     * la primera fila vive en la página anterior; se carga aparte.
     */
    async historial(
        id: string,
        page: number,
        pageSize: number
    ): Promise<{ items: ItemHistorialRegla[]; pagination: Paginacion }> {
        const regla = await this.repo.obtenerPorId(id);
        if (!regla) throw noEncontrado();
        const { items, total } = await this.repo.listarHistorial(id, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        const snapshotActual = construirSnapshot(regla);
        const primera = items[0];
        const versionMaximaHistorial = page === 1 ? null : primera?.version ?? null;
        // En página 1 la primera fila diff contra la regla actual; en páginas
        // siguientes, contra el snapshot de la versión inmediata superior.
        const frontera =
            page === 1 || versionMaximaHistorial === null
                ? snapshotActual
                : ((await this.repo.obtenerHistorialPorVersion(id, versionMaximaHistorial + 1))?.snapshot as
                      | Record<string, unknown>
                      | undefined) ?? snapshotActual;
        const mapeados = items.map((entrada, indice): ItemHistorialRegla => {
            const snapshotEntrada = entrada.snapshot as Record<string, unknown>;
            const despues =
                indice === 0 ? frontera : (items[indice - 1]?.snapshot as Record<string, unknown>);
            return {
                version: entrada.version,
                creadoEn: entrada.creadoEn.toISOString(),
                cambiadoPor: {
                    id: entrada.cambiadoPor.id,
                    nombre: entrada.cambiadoPor.nombre ?? "Administrador",
                },
                motivo: entrada.motivo,
                camposCambiados: diffCampos(snapshotEntrada, despues),
                snapshot: snapshotEntrada,
            };
        });
        return { items: mapeados, pagination: paginacion(page, pageSize, total) };
    }

    /**
     * POST /api/admin/analisis/reglas/test-sql — validación estática + envoltura
     * LIMIT + ejecución READ ONLY con timeout acotado + auditoría de metadatos.
     */
    async probarSql(body: TestSqlBody, audit: ContextoAudit): Promise<ResultadoTestSql> {
        assertSqlValido(body.sqlQuery);
        const [paramTimeout, paramMaxFilas] = await Promise.all([
            this.params.findByClave(CLAVE_TIMEOUT_TEST),
            this.params.findByClave(CLAVE_MAX_FILAS_TEST),
        ]);
        const timeoutMs = acotarTimeoutMs(paramTimeout ? parseInt(paramTimeout.valor, 10) : null);
        const maxFilas = acotarMaxFilas(paramMaxFilas ? parseInt(paramMaxFilas.valor, 10) : null);
        const sqlEnvuelta = envolverConLimit(body.sqlQuery, maxFilas);

        const t0 = Date.now();
        let filas: Array<Record<string, unknown>>;
        try {
            filas = await this.sandbox.ejecutarQuerySoloLectura(sqlEnvuelta, timeoutMs);
        } catch (error) {
            throw new AppError(mensajeErrorPg(error, timeoutMs), ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const duracionMs = Date.now() - t0;

        await this.repo.auditarTestSql({
            huellaQuery: huellaQuery(body.sqlQuery),
            duracionMs,
            filasMuestra: filas.length,
            reglaId: body.reglaId,
            audit,
        });

        return {
            columnas: extraerColumnas(filas),
            filas,
            filasMuestra: filas.length,
            duracionMs,
            limitAplicado: maxFilas,
            timeoutMs,
        };
    }
}

export type { HistorialConAdmin };

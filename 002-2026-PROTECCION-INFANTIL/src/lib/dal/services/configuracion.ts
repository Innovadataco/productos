/**
 * SPEC-053 (US3, módulo Configuración): ConfiguracionService.
 * Listado admin, parámetros públicos, detalle con historial, actualización con
 * cifrado de secretos + auditoría, eliminación con protección de críticos y
 * revelado de secretos. La validación HTTP (Zod, R2 de Ollama) y la caché de
 * configuración quedan en la ruta / su adaptador. Acepta tx opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { encryptParameter, decryptParameter } from "@/lib/param-encryption";
import { logAudit } from "@/lib/audit";
import { GRUPOS_CATEGORIA_FALLBACK } from "@/lib/categoria-grupos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ParametroRepository } from "../repositories/parametro";
import type {
    CategoriaParametroDto,
    ParametroDetalleDto,
    ParametroDto,
    ParametroListaDto,
    ParametroPatchInput,
    ParametroPublicoValorDto,
    TipoParametroDto,
} from "../types/parametro";

const PARAM_CREATE_DEFAULTS: Record<
    string,
    {
        valor: string;
        tipo: TipoParametroDto;
        categoria: CategoriaParametroDto;
        esPublico?: boolean;
        esSecreto?: boolean;
        descripcion?: string;
    }
> = {
    "ui.grupos_categoria": {
        valor: JSON.stringify({ grupos: GRUPOS_CATEGORIA_FALLBACK }),
        tipo: "JSON",
        categoria: "SYSTEM",
        esPublico: true,
        esSecreto: false,
        descripcion: "Grupos de presentación de categorías de conducta para el usuario final",
    },
};

type ParametroRow = Prisma.ParametroSistemaGetPayload<Record<string, never>>;

function sanitizar(p: ParametroRow): ParametroDto {
    return { ...p, valor: p.esSecreto ? null : p.valor };
}

function parseValue(valor: string, tipo: string): unknown {
    switch (tipo) {
        case "INTEGER":
            return parseInt(valor, 10);
        case "FLOAT":
            return parseFloat(valor);
        case "BOOLEAN":
            return valor === "true";
        case "JSON":
            return JSON.parse(valor);
        case "STRING_ARRAY":
            return JSON.parse(valor);
        default:
            return valor;
    }
}

export class ConfiguracionService {
    private readonly parametros: ParametroRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.parametros = new ParametroRepository(tx);
    }

    /** GET /api/config/parametros — listado admin paginado (secretos sanitizados). */
    async listar(input: { categoria: string | null; page: number; pageSize: number }): Promise<ParametroListaDto> {
        const { categoria, page, pageSize } = input;
        const where: Prisma.ParametroSistemaWhereInput = categoria ? { categoria: categoria as never } : {};

        const [items, total] = await this.parametros.findPaginadosConTotal(where, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return {
            items: items.map(sanitizar),
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
    }

    /** GET /api/config/parametros/publicos — valores públicos parseados por tipo. */
    async publicos(): Promise<Record<string, ParametroPublicoValorDto>> {
        const params = await this.parametros.findPublicos();
        const result: Record<string, ParametroPublicoValorDto> = {};
        for (const p of params) {
            result[p.clave] = {
                valor: parseValue(p.valor, p.tipo),
                tipo: p.tipo,
                descripcion: p.descripcion,
            };
        }
        return result;
    }

    /** GET /api/config/parametros/[clave] — detalle con historial (secreto sanitizado). */
    async obtenerConHistorial(clave: string): Promise<ParametroDetalleDto> {
        const param = await this.parametros.findByClaveConHistorial(clave);
        if (!param) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const { auditLogs, ...resto } = param;
        return {
            ...sanitizar(resto),
            historial: auditLogs.map((a) => ({
                valorAnterior: a.valorAnterior,
                valorNuevo: a.valorNuevo,
                actualizadoPor: a.usuario?.email,
                actualizadoEn: a.creadoEn,
            })),
        };
    }

    /**
     * PATCH /api/config/parametros/[clave] — crea o actualiza. Cifra el valor si
     * el parámetro es secreto y registra auditoría (como la ruta original).
     */
    async actualizar(clave: string, body: ParametroPatchInput, usuarioId: string): Promise<ParametroDto> {
        // Camino HTTP: SIEMPRE con actor no-nulo (la ruta pasa user.id). El tipo `usuarioId: string`
        // es la compuerta — una ruta que olvide el actor NO compila (ver configuracion-corrector.candado).
        return this.aplicar(clave, body, usuarioId, body.motivo);
    }

    /**
     * SPEC-812 (pieza 3) · Cambio de un parámetro por un CORRECTOR operativo: un script SIN sesión
     * (lo corre el CEO desde el contenedor), no la API. El actor queda NULL a propósito —no hay un
     * Usuario que haya hecho el cambio, y un Usuario fabricado para satisfacer el FK es una mentira
     * con forma de dato— y la responsabilidad del HECHO se registra por `motivo` (OBLIGATORIO, no
     * vacío) en el AuditLog. Las rutas HTTP NO usan esto: siguen por `actualizar()`, que exige actor
     * string. Aflojar para el script no afloja la API: es un método distinto (imposibilidad
     * estructural), no un tipo relajado compartido que una ruta futura pueda pasar en null en silencio.
     */
    async actualizarComoCorrectorOperativo(clave: string, body: ParametroPatchInput, motivo: string): Promise<ParametroDto> {
        const motivoLimpio = motivo?.trim();
        if (!motivoLimpio) {
            // Sin actor, el motivo es el ÚNICO rastro de responsabilidad: un motivo vacío cambiaría
            // «actor fabricado» por «rastro vacío» — el mismo agujero con otra forma.
            throw new AppError(
                "Un corrector operativo debe registrar un motivo no vacío (es el único rastro: el actor va en null).",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }
        return this.aplicar(clave, body, null, motivoLimpio);
    }

    /** Implementación única de crear/actualizar + cifrado + auditoría. `actor` es string para el
     *  camino HTTP y null SOLO para el corrector operativo (que exige `motivo` no vacío). */
    private async aplicar(
        clave: string,
        body: ParametroPatchInput,
        actor: string | null,
        motivo: string | undefined
    ): Promise<ParametroDto> {
        const existing = await this.parametros.findByClave(clave);
        const isNew = !existing;

        const defaults = isNew ? PARAM_CREATE_DEFAULTS[clave] : undefined;
        if (isNew && !defaults && !body.tipo) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const esSecreto = existing?.esSecreto ?? body.esSecreto ?? defaults?.esSecreto ?? false;
        const valorParaGuardar = esSecreto ? encryptParameter(body.valor) : body.valor;

        let param;
        if (isNew) {
            const tipo = body.tipo ?? defaults?.tipo;
            const categoria = body.categoria ?? defaults?.categoria;
            if (!tipo || !categoria) {
                // Parámetro nuevo sin defaults y sin tipo/categoría en el body:
                // antes podía terminar en TypeError (500); ahora es error canónico controlado.
                throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
            }
            param = await this.parametros.crear({
                clave,
                valor: valorParaGuardar,
                tipo,
                categoria,
                esPublico: body.esPublico ?? defaults?.esPublico ?? false,
                esSecreto,
                // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                ...(body.descripcion !== undefined
                    ? { descripcion: body.descripcion }
                    : defaults?.descripcion !== undefined
                        ? { descripcion: defaults.descripcion }
                        : {}),
                actualizadoPorId: actor,
            });
        } else {
            param = await this.parametros.actualizar(clave, { valor: valorParaGuardar, actualizadoPorId: actor });
        }

        await logAudit({
            accion: "PARAM_UPDATE",
            tipoRecurso: "parametro",
            recursoId: param.id,
            parametroId: param.id,
            // actor null (corrector) → logAudit escribe usuarioId = NULL en la fila (camino verificado,
            // no solo columna nullable). La API siempre pasa un id real.
            usuarioId: actor ?? undefined,
            valorAnterior: isNew ? undefined : existing?.valor,
            valorNuevo: valorParaGuardar,
            metadatos: { motivo, esSecreto, nuevo: isNew, corrector: actor === null },
        });

        return sanitizar(param);
    }

    /** DELETE /api/config/parametros/[clave] — protege parámetros críticos. */
    async eliminar(clave: string): Promise<void> {
        const param = await this.parametros.findByClave(clave);
        if (!param) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        if (param.categoria === "SYSTEM" || param.clave.startsWith("security.")) {
            throw new AppError("Parámetro crítico no puede eliminarse", ERROR_CODES.CONFLICT, 409);
        }

        await this.parametros.eliminar(clave);
    }

    /** POST /api/config/parametros/[clave]/revelar — descifra un secreto. */
    async revelar(clave: string): Promise<{ valor: string }> {
        const param = await this.parametros.findByClave(clave);
        if (!param) {
            throw new AppError("Parámetro no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!param.esSecreto) {
            throw new AppError("Solo se pueden revelar parámetros secretos", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (!param.valor) {
            return { valor: "" };
        }

        return { valor: decryptParameter(param.valor) };
    }
}

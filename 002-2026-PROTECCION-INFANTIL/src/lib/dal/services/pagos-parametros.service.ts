/**
 * SPEC-243 (002-PI-146): servicio DAL para los parámetros globales de pagos.
 */
import { TipoParametro } from "@prisma/client";
import { withUnitOfWork } from "../unit-of-work";

const CLAVES_PARAMETROS = [
    "pagos.iva.porcentaje",
    "pagos.iva.aplica_a",
    "pagos.freemium.activo",
    "pagos.freemium.duracion_dias",
    "pagos.recompensa.activa",
    "pagos.recompensa.meses_gratis",
    "pagos.recompensa.max_por_año",
] as const;

export type ClaveParametroPago = (typeof CLAVES_PARAMETROS)[number];

const TIPO_POR_CLAVE: Record<ClaveParametroPago, TipoParametro> = {
    "pagos.iva.porcentaje": TipoParametro.FLOAT,
    "pagos.iva.aplica_a": TipoParametro.STRING,
    "pagos.freemium.activo": TipoParametro.BOOLEAN,
    "pagos.freemium.duracion_dias": TipoParametro.INTEGER,
    "pagos.recompensa.activa": TipoParametro.BOOLEAN,
    "pagos.recompensa.meses_gratis": TipoParametro.INTEGER,
    "pagos.recompensa.max_por_año": TipoParametro.INTEGER,
};

function valorAString(valor: unknown): string {
    if (typeof valor === "boolean") return valor ? "true" : "false";
    return String(valor);
}

export interface BatchParametrosPagoInput {
    "pagos.iva.porcentaje": number;
    "pagos.iva.aplica_a": string;
    "pagos.freemium.activo": boolean;
    "pagos.freemium.duracion_dias": number;
    "pagos.recompensa.activa": boolean;
    "pagos.recompensa.meses_gratis": number;
    "pagos.recompensa.max_por_año": number;
}

export interface ResultadoBatchParametros {
    antes: Record<string, string | null>;
    despues: Record<string, string>;
}

export class PagosParametrosService {
    /**
     * Actualiza en una sola transacción las 7 claves globales de pagos y
     * devuelve el snapshot antes/después para auditoría.
     */
    async actualizarBatch(
        adminId: string,
        input: BatchParametrosPagoInput
    ): Promise<ResultadoBatchParametros> {
        return withUnitOfWork(async (tx) => {
            const antes: Record<string, string | null> = {};
            const despues: Record<string, string> = {};

            for (const clave of CLAVES_PARAMETROS) {
                const existente = await tx.parametroSistema.findUnique({ where: { clave } });
                antes[clave] = existente?.valor ?? null;
                const valor = valorAString(input[clave]);
                despues[clave] = valor;
                await tx.parametroSistema.upsert({
                    where: { clave },
                    update: { valor, actualizadoPorId: adminId },
                    create: {
                        clave,
                        valor,
                        tipo: TIPO_POR_CLAVE[clave],
                        categoria: "SYSTEM",
                        esPublico: false,
                        descripcion: `Parámetro global de pagos: ${clave}`,
                    },
                });
            }

            return { antes, despues };
        });
    }
}

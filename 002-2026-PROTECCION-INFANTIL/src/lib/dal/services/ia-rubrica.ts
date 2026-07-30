/**
 * SPEC-053 (US3, módulo IA): IaRubricaService.
 * Parámetros operativos de la rúbrica (modelos, temperatura, umbral, embudo) y
 * sets de preguntas por categoría (lee-modifica-escribe sobre el JSON
 * `ia.rubrica.preguntas`). Auditoría PARAM_UPDATE por cambio. Acepta tx opcional (D2).
 */
import type { CategoriaConducta, Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getParametroSistema } from "@/lib/parametros";
import { invalidateCache } from "@/lib/config-cache";
import { RUBRICA_SEMILLA, type PreguntaRubrica, type SetsRubrica } from "@/lib/ai/rubrica-semilla";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ParametroRepository } from "../repositories/parametro";
import type { InfoClienteDto } from "../types/operador";

const CLAVE_PREGUNTAS = "ia.rubrica.preguntas";

const CLAVES = {
    modelos: "ia.rubrica.modelos",
    temperatura: "ia.rubrica.temperatura",
    umbralPresencia: "ia.rubrica.umbral_presencia",
    modeloEmbudo: "ia.rubrica.modelo_embudo",
} as const;

const TIPOS = {
    modelos: "JSON",
    temperatura: "FLOAT",
    umbralPresencia: "FLOAT",
    modeloEmbudo: "STRING",
} as const;

export interface CambiosConfigRubrica {
    modelos?: string[];
    temperatura?: number;
    umbralPresencia?: number;
    modeloEmbudo?: string;
}

export class IaRubricaService {
    private readonly parametros: ParametroRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.parametros = new ParametroRepository(tx);
    }

    /** PATCH /api/admin/ia/rubrica/config — upsert por parámetro con auditoría individual. */
    async actualizarConfig(cambios: CambiosConfigRubrica, usuarioId: string, info: InfoClienteDto) {
        const actualizados: Record<string, string> = {};

        for (const campo of Object.keys(CLAVES) as Array<keyof typeof CLAVES>) {
            const valor = cambios[campo];
            if (valor === undefined) continue;

            const clave = CLAVES[campo];
            const valorStr = campo === "modelos" ? JSON.stringify(valor) : String(valor);

            const existing = await this.parametros.findByClave(clave);
            const guardado = existing
                ? await this.parametros.actualizar(clave, { valor: valorStr, actualizadoPorId: usuarioId })
                : await this.parametros.crear({
                      clave,
                      valor: valorStr,
                      tipo: TIPOS[campo],
                      categoria: "SYSTEM",
                      esPublico: false,
                      actualizadoPorId: usuarioId,
                  });

            await logAudit({
                accion: "PARAM_UPDATE",
                tipoRecurso: "parametro",
                recursoId: guardado.id,
                parametroId: guardado.id,
                usuarioId,
                valorAnterior: existing?.valor,
                valorNuevo: valorStr,
                metadatos: { clave },
                ipAddress: info.ipAddress,
                userAgent: info.userAgent,
            });

            actualizados[clave] = valorStr;
        }

        invalidateCache("public_params");

        return { actualizados };
    }

    /** PUT /api/admin/ia/rubrica/preguntas — reemplaza el set de UNA categoría (con auditoría). */
    async actualizarPreguntas(
        categoria: CategoriaConducta,
        preguntas: PreguntaRubrica[],
        usuarioId: string,
        info: InfoClienteDto
    ) {
        const param = await getParametroSistema(CLAVE_PREGUNTAS);
        let sets: SetsRubrica;
        if (param) {
            try {
                sets = JSON.parse(param.valor) as SetsRubrica;
            } catch {
                throw new AppError("El parámetro ia.rubrica.preguntas tiene JSON inválido", ERROR_CODES.INTERNAL_ERROR, 500);
            }
        } else {
            sets = RUBRICA_SEMILLA;
        }

        const valorAnteriorCategoria = JSON.stringify(sets[categoria] ?? []);
        sets = { ...sets, [categoria]: preguntas };
        const valorNuevo = JSON.stringify(sets);

        const guardado = param
            ? await this.parametros.actualizar(CLAVE_PREGUNTAS, { valor: valorNuevo, actualizadoPorId: usuarioId })
            : await this.parametros.crear({
                  clave: CLAVE_PREGUNTAS,
                  valor: valorNuevo,
                  tipo: "JSON",
                  categoria: "SYSTEM",
                  esPublico: false,
                  actualizadoPorId: usuarioId,
              });

        await logAudit({
            accion: "PARAM_UPDATE",
            tipoRecurso: "parametro",
            recursoId: guardado.id,
            parametroId: guardado.id,
            usuarioId,
            valorAnterior: valorAnteriorCategoria,
            valorNuevo: JSON.stringify(preguntas),
            metadatos: { clave: CLAVE_PREGUNTAS, categoria },
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        invalidateCache("public_params");
    }
}

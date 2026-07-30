/**
 * SPEC-053 (US3, módulo Apelaciones): ApelacionService.
 * Radicación por el titular (SPEC-110) y lista de las propias apelaciones.
 * La evidencia (PDF cifrado en disco) la maneja la ruta con `apelacion-storage`
 * (infraestructura de archivos); los helpers de dominio (plazo, número,
 * conteo de reportes) viven en `src/lib/apelaciones.ts`. Acepta tx opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { contarReportesAsociados } from "@/lib/apelaciones";
import { ApelacionRepository } from "../repositories/apelacion";
import { PlataformaRepository } from "../repositories/plataforma";
import type { MisApelacionesDto, ResultadoPreparacionRadicacion } from "../types/apelacion";

export class ApelacionService {
    private readonly apelaciones: ApelacionRepository;
    private readonly plataformas: PlataformaRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.apelaciones = new ApelacionRepository(tx);
        this.plataformas = new PlataformaRepository(tx);
    }

    /**
     * Validaciones previas a persistir la evidencia: plataforma válida y sin
     * apelación abierta del mismo usuario para el identificador.
     */
    async prepararRadicacion(input: {
        usuarioId: string;
        identificador: string;
        plataformaId: string;
    }): Promise<ResultadoPreparacionRadicacion> {
        const plataforma = await this.plataformas.findById(input.plataformaId);
        if (!plataforma) {
            return { ok: false, tipo: "plataforma_invalida" };
        }

        const abiertaExistente = await this.apelaciones.findAbierta(input.usuarioId, input.identificador, input.plataformaId);
        if (abiertaExistente) {
            return { ok: false, tipo: "conflicto" };
        }

        return { ok: true };
    }

    /**
     * Crea la apelación con su documento (nested create). Una carrera sobre el
     * índice único parcial de apelación abierta propaga P2002: la ruta compensa
     * borrando el archivo de evidencia y responde 409.
     */
    radicar(data: Prisma.ApelacionCreateInput) {
        return this.apelaciones.crearConDocumento(data);
    }

    /**
     * GET /api/apelaciones/mias — lista del usuario. El apelante NO ve contenido
     * de reportes: solo el conteo derivado (regla dura SPEC-110).
     */
    async mias(usuarioId: string, page: number, pageSize: number): Promise<MisApelacionesDto> {
        const [apelaciones, total] = await this.apelaciones.findPaginadasPorUsuario(usuarioId, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        const items = await Promise.all(
            apelaciones.map(async (a) => ({
                id: a.id,
                numero: a.numero,
                identificador: a.identificador,
                plataforma: a.plataforma,
                estado: a.estado as string,
                esRepresentante: a.esRepresentante,
                creadoEn: a.creadoEn,
                plazoRespuestaEn: a.plazoRespuestaEn,
                decision: a.decision as string | null,
                motivacionResolucion: a.motivacionResolucion,
                resueltoEn: a.resueltoEn,
                numeroReportesAsociados: await contarReportesAsociados(a.identificador, a.plataformaId),
                documentoNombre: a.documentos[0]?.nombreOriginal ?? null,
                documentoEliminadoEn: a.documentos[0]?.eliminadoEn ?? null,
            }))
        );

        return {
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        };
    }
}

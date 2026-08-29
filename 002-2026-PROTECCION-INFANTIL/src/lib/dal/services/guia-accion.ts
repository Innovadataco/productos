/**
 * SPEC-235 (002-PI-135): servicio de dominio para guías de acción.
 * Orquesta el repositorio, la auditoría y las transiciones de estado.
 */
import type { Prisma } from "@prisma/client";
import { EstadoGuiaAccion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { getParametroSistema } from "@/lib/parametros";
import { withUnitOfWork } from "../unit-of-work";
import { GuiaAccionRepository, type CrearGuiaAccionInput, type EditarGuiaAccionInput } from "../repositories/guia-accion-repository";
import { assertTransicionValida, puedeEditarContenido } from "@/lib/guias-accion/estado";

export interface VotoComite {
    usuarioId: string;
    email: string;
    nombre?: string | null;
    aprobadoEn: string;
}

export class GuiaAccionService {
    private readonly repo: GuiaAccionRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.repo = new GuiaAccionRepository(tx);
    }

    async crear(input: CrearGuiaAccionInput) {
        return this.repo.crear(input);
    }

    async editar(id: string, input: EditarGuiaAccionInput, adminId: string) {
        const guia = await this.repo.buscarPorId(id);
        if (!guia) {
            throw new AppError("Guía no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!puedeEditarContenido(guia.estado)) {
            throw new AppError(
                "Solo se puede editar una guía en estado BORRADOR",
                ERROR_CODES.CONFLICT,
                409
            );
        }
        const editada = await this.repo.editarContenido(id, input);
        await this.auditar({
            accion: "GUIA_ACCION_EDITADA",
            guiaId: id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: guia.estado }),
            valorNuevo: JSON.stringify({ estado: editada.estado }),
        });
        return editada;
    }

    async enviarAComite(id: string, adminId: string) {
        const guia = await this.repo.requiereEstado(id, EstadoGuiaAccion.BORRADOR);
        const actualizada = await this.repo.enviarAComite(id);
        await this.auditar({
            accion: "GUIA_ACCION_ENVIADA_COMITE",
            guiaId: id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: guia.estado }),
            valorNuevo: JSON.stringify({ estado: actualizada.estado }),
        });
        return actualizada;
    }

    async aprobar(id: string, miembro: VotoComite) {
        const guia = await this.repo.requiereEstado(id, EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE);
        const votos = (guia.aprobadaPorComiteJson as unknown as VotoComite[]) ?? [];
        if (votos.some((v) => v.usuarioId === miembro.usuarioId)) {
            throw new AppError("Ya aprobaste esta guía", ERROR_CODES.CONFLICT, 409);
        }

        const nuevosVotos = [...votos, miembro];
        const minimoVotos = await this.obtenerMinimoAprobacion();

        if (nuevosVotos.length >= minimoVotos) {
            return withUnitOfWork(async (tx) => {
                const repoTx = new GuiaAccionRepository(tx);
                await repoTx.reemplazarActivaPorCategoria(guia.categoria);
                await repoTx.actualizarVotos(id, nuevosVotos as unknown as Prisma.InputJsonValue);
                const publicada = await repoTx.publicar(id);
                await this.auditar({
                    accion: "GUIA_ACCION_PUBLICADA",
                    guiaId: id,
                    usuarioId: miembro.usuarioId,
                    valorAnterior: JSON.stringify({ estado: guia.estado, votos: votos.length }),
                    valorNuevo: JSON.stringify({ estado: publicada.estado, votos: nuevosVotos.length }),
                    tx,
                });
                // Registramos también el voto individual del último miembro.
                await this.auditar({
                    accion: "GUIA_ACCION_APROBADA",
                    guiaId: id,
                    usuarioId: miembro.usuarioId,
                    valorNuevo: JSON.stringify({ email: miembro.email, votosTotales: nuevosVotos.length }),
                    tx,
                });
                return publicada;
            });
        }

        await this.repo.actualizarVotos(id, nuevosVotos as unknown as Prisma.InputJsonValue);
        await this.auditar({
            accion: "GUIA_ACCION_APROBADA",
            guiaId: id,
            usuarioId: miembro.usuarioId,
            valorNuevo: JSON.stringify({ email: miembro.email, votosTotales: nuevosVotos.length }),
        });
        return this.repo.buscarPorId(id);
    }

    async rechazar(id: string, miembro: VotoComite, motivo: string) {
        const guia = await this.repo.requiereEstado(id, EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE);
        const actualizada = await this.repo.rechazar(id);
        await this.auditar({
            accion: "GUIA_ACCION_RECHAZADA",
            guiaId: id,
            usuarioId: miembro.usuarioId,
            valorAnterior: JSON.stringify({ estado: guia.estado }),
            valorNuevo: JSON.stringify({ estado: actualizada.estado, motivo }),
        });
        return actualizada;
    }

    async listar(filtros: { estado?: EstadoGuiaAccion; categoria?: string; page: number; pageSize: number }) {
        return this.repo.listar(filtros);
    }

    async listarPendientesDeAprobacion(paginacion: { page: number; pageSize: number }) {
        return this.repo.listarPendientesDeAprobacion(paginacion);
    }

    async preview(id: string) {
        const guia = await this.repo.buscarPorId(id);
        if (!guia) {
            throw new AppError("Guía no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        return guia;
    }

    async consultaPublica(categoria: string) {
        return this.repo.buscarActivaPorCategoria(categoria);
    }

    private async obtenerMinimoAprobacion(): Promise<number> {
        const param = await getParametroSistema("padre.comite.miembros_minimos_aprobacion");
        const valor = param ? parseInt(param.valor, 10) : 2;
        return Number.isNaN(valor) || valor < 1 ? 2 : valor;
    }

    private async auditar(params: {
        accion: "GUIA_ACCION_CREADA" | "GUIA_ACCION_EDITADA" | "GUIA_ACCION_ENVIADA_COMITE" | "GUIA_ACCION_APROBADA" | "GUIA_ACCION_RECHAZADA" | "GUIA_ACCION_PUBLICADA" | "GUIA_ACCION_REEMPLAZADA";
        guiaId: string;
        usuarioId: string;
        valorAnterior?: string;
        valorNuevo?: string;
        tx?: Prisma.TransactionClient;
    }) {
        await logAudit({
            accion: params.accion,
            tipoRecurso: "GuiaAccionCategoria",
            recursoId: params.guiaId,
            usuarioId: params.usuarioId,
            valorAnterior: params.valorAnterior,
            valorNuevo: params.valorNuevo,
            tx: params.tx,
        });
    }
}

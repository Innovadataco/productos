/**
 * SPEC-436 (I-304) · Repositorio de los documentos que carga el profesional.
 * Q-3: el acceso a Prisma vive acá; los services y los routes componen.
 */
import type { DocumentoProfesional, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class DocumentoProfesionalRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * SPEC-693 (I-416): sube una versión NUEVA de un requisito como EN_REVISION,
     * **sin tocar la VIGENTE** — el profesional sigue atendiendo con la aprobada
     * mientras la nueva se revisa. Si ya había una EN_REVISION sin revisar, la
     * reemplaza (re-subida antes de revisar). El índice único parcial garantiza
     * ≤1 EN_REVISION por (perfil,requisito); acá lo respetamos leyendo primero.
     *
     * Deroga el `upsert` sobre `(perfil,requisito)` que PISABA la aprobada — la
     * causa de que «seguir atendiendo con la anterior» fuera imposible.
     */
    async guardar(datos: {
        perfilProfesionalId: string;
        requisitoClave: string;
        archivoId: string;
        extension: string;
        sha256: string;
    }): Promise<DocumentoProfesional> {
        const { perfilProfesionalId, requisitoClave, ...resto } = datos;
        const pendiente = await this.db.documentoProfesional.findFirst({
            where: { perfilProfesionalId, requisitoClave, estado: "EN_REVISION" },
        });
        if (pendiente) {
            return this.db.documentoProfesional.update({
                where: { id: pendiente.id },
                data: { ...resto, subidoEn: new Date() },
            });
        }
        return this.db.documentoProfesional.create({
            data: { perfilProfesionalId, requisitoClave, estado: "EN_REVISION", ...resto },
        });
    }

    /** La versión VIGENTE (aprobada, la que respalda) de un requisito, o null. */
    buscarVigente(perfilProfesionalId: string, requisitoClave: string): Promise<DocumentoProfesional | null> {
        return this.db.documentoProfesional.findFirst({
            where: { perfilProfesionalId, requisitoClave, estado: "VIGENTE" },
        });
    }

    /** La versión EN_REVISION (pendiente) de un requisito, o null. */
    buscarPendiente(perfilProfesionalId: string, requisitoClave: string): Promise<DocumentoProfesional | null> {
        return this.db.documentoProfesional.findFirst({
            where: { perfilProfesionalId, requisitoClave, estado: "EN_REVISION" },
        });
    }

    /** Documentos ACTUALES por perfil (VIGENTE + EN_REVISION), no el historial. */
    listarPorPerfil(perfilProfesionalId: string): Promise<DocumentoProfesional[]> {
        return this.db.documentoProfesional.findMany({
            where: { perfilProfesionalId, estado: { in: ["VIGENTE", "EN_REVISION"] } },
            orderBy: [{ requisitoClave: "asc" }, { estado: "asc" }],
        });
    }

    /**
     * La versión que se SIRVE por defecto para un requisito: la VIGENTE (aprobada)
     * si existe; si aún no hay ninguna aprobada, la pendiente. Los históricos
     * (SUPERSEDIDA/DEVUELTA) no se sirven por acá.
     */
    async buscar(perfilProfesionalId: string, requisitoClave: string): Promise<DocumentoProfesional | null> {
        return (
            (await this.buscarVigente(perfilProfesionalId, requisitoClave)) ??
            (await this.buscarPendiente(perfilProfesionalId, requisitoClave))
        );
    }

    /**
     * SPEC-693 (I-416): APROBAR una versión pendiente — la vuelve VIGENTE y deja
     * la anterior VIGENTE (si había) como SUPERSEDIDA (no se pierde). El ORDEN
     * importa: primero se degrada la vieja, luego se promueve la nueva, para no
     * tener dos VIGENTE a la vez (el índice único parcial lo rechazaría). Devuelve
     * la versión ahora VIGENTE, o null si no había pendiente. Correr en transacción.
     */
    async promoverPendienteAVigente(
        perfilProfesionalId: string,
        requisitoClave: string,
    ): Promise<DocumentoProfesional | null> {
        const pendiente = await this.buscarPendiente(perfilProfesionalId, requisitoClave);
        if (!pendiente) return null;
        const vigente = await this.buscarVigente(perfilProfesionalId, requisitoClave);
        if (vigente) {
            await this.db.documentoProfesional.update({
                where: { id: vigente.id },
                data: { estado: "SUPERSEDIDA" },
            });
        }
        return this.db.documentoProfesional.update({
            where: { id: pendiente.id },
            data: { estado: "VIGENTE" },
        });
    }

    /**
     * SPEC-693 (I-416): DEVOLVER una versión pendiente — la marca DEVUELTA (queda
     * como historia); la VIGENTE anterior sigue respaldando. Devuelve la versión
     * devuelta, o null si no había pendiente.
     */
    async marcarPendienteDevuelta(
        perfilProfesionalId: string,
        requisitoClave: string,
    ): Promise<DocumentoProfesional | null> {
        const pendiente = await this.buscarPendiente(perfilProfesionalId, requisitoClave);
        if (!pendiente) return null;
        return this.db.documentoProfesional.update({
            where: { id: pendiente.id },
            data: { estado: "DEVUELTA" },
        });
    }
}

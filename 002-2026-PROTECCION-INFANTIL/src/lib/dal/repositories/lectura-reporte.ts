/**
 * SPEC-584 (Fase 2) · Repositorio de la auditoría de lectura del texto.
 */
import { prisma } from "../../prisma";
import type { DbClient } from "../unit-of-work";
import type { Prisma } from "@prisma/client";

export class LecturaReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Historial de accesos al texto de un reporte (más reciente primero).
     * Solo metadatos: quién, cuándo, qué campo — nunca contenido.
     */
    historialPorReporte(reporteId: string, limite = 50) {
        return this.db.lecturaReporte.findMany({
            where: { reporteId },
            orderBy: { creadoEn: "desc" },
            take: limite,
            select: {
                id: true,
                creadoEn: true,
                campo: true,
                tipoActor: true,
                rol: true,
                usuario: { select: { nombre: true, email: true, rol: true } },
            },
        });
    }

    /**
     * SPEC-785 · Rastro de accesos AL DATO DEL TITULAR (padre) — su derecho de habeas data
     * (Ley 1581 art. 8 lit. a / art. 4 lit. f, transparencia). Devuelve accesos de OTROS al texto
     * de SUS reportes/expediente: `rol` (INSTANTÁNEA del momento — no el rol actual del lector,
     * que pudo cambiar), en qué calidad (`tipoActor`), qué campo y cuándo.
     *
     * A diferencia de `historialPorReporte` (vista de ADMIN, que SÍ trae nombre/email), acá el
     * `select` es la LISTA BLANCA por construcción: solo momento/rol/tipoActor/campo. NUNCA la
     * identidad del lector (nombre/email/usuarioId), ni contenido, ni hash, ni ip/ua, ni ids. No
     * hay fila cruda ni metadatos que recortar — la estructura lo impide.
     *
     * Filtro por TITULAR en las DOS direcciones (fallar de más muestra otra familia; de menos deja
     * el derecho incompleto y no se nota): `reporte.usuarioId` o `evento.expediente.padreUsuarioId`.
     * EXCLUYE el autoacceso del titular (su propia actividad es otra función — ver límites en la
     * spec). Conserva lecturas cuyo lector fue anonimizado (usuarioId null por SetNull, SPEC-701):
     * el `rol` instantánea sobrevive, así que el acceso sigue contando.
     */
    rastroDeAccesosDelTitular(titularId: string, limite = 100) {
        return this.db.lecturaReporte.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { reporte: { usuarioId: titularId } },
                            { evento: { expediente: { padreUsuarioId: titularId } } },
                        ],
                    },
                    // Excluir SOLO el autoacceso del titular, conservando las filas con lector
                    // anonimizado (usuarioId null): `NOT usuarioId=titular` a secas las tiraría.
                    { OR: [{ usuarioId: null }, { usuarioId: { not: titularId } }] },
                ],
            },
            orderBy: { creadoEn: "desc" },
            take: limite,
            select: { creadoEn: true, campo: true, tipoActor: true, rol: true },
        });
    }
}

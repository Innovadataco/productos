/**
 * SPEC-714 · Materializar franjas en LOTE (repetir un patrón, copiar un día).
 *
 * v1 sin modelo de series: «cada martes» / «lun-vie» / «copiar día» se traducen
 * a filas `FranjaDisponible` concretas. Cada una pasa por las MISMAS cuatro
 * reglas del servidor que la creación unitaria (`franjas/route.ts`): modalidad
 * que atiende, `fin>inicio`, muro de vigencia (`fin<=venceEn`) y no-solape. Las
 * que no caben **no se crean** y se dice cuántas sí (forma de Diseño: «las que no
 * caben, no se crean»). Todo en UNA unidad de trabajo: o se valida el lote
 * completo con la agenda coherente, o no se escribe nada a medias.
 *
 * El no-solape se evalúa contra la agenda dentro de la tx, así que dos entradas
 * del mismo lote que se pisen entre sí también se detectan (la primera se crea y
 * la segunda se omite por solape). Se ordenan por inicio para que sea determinista.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { DiaBloqueadoRepository } from "@/lib/dal/repositories/dia-bloqueado";
import { diaBogota } from "@/lib/fechas/formato-bogota";

export interface FranjaLoteInput {
    inicio: string; // ISO UTC
    fin: string; // ISO UTC
    modalidad: "VIRTUAL" | "PRESENCIAL";
}

export type MotivoOmision = "rango" | "modalidad" | "vigencia" | "bloqueado" | "solape";

export interface ResultadoLote {
    creadas: number;
    omitidas: { inicio: string; motivo: MotivoOmision }[];
}

export async function materializarFranjas(
    perfilId: string,
    entradas: FranjaLoteInput[],
): Promise<ResultadoLote> {
    return withUnitOfWork(async (tx) => {
        const perfil = await new PerfilProfesionalRepository(tx).findPorId(perfilId);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const venceEn = await new PerfilProfesionalRepository(tx).venceEnVigente(perfilId);
        if (!venceEn) {
            throw new AppError(
                "Necesita una verificación aprobada para publicar disponibilidad",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        const repo = new FranjaDisponibleRepository(tx);
        const diasRepo = new DiaBloqueadoRepository(tx);
        const omitidas: ResultadoLote["omitidas"] = [];
        let creadas = 0;

        const ordenadas = [...entradas].sort((a, b) => a.inicio.localeCompare(b.inicio));
        for (const e of ordenadas) {
            const inicio = new Date(e.inicio);
            const fin = new Date(e.fin);
            if (fin.getTime() <= inicio.getTime()) {
                omitidas.push({ inicio: e.inicio, motivo: "rango" });
                continue;
            }
            if (e.modalidad === "VIRTUAL" && !perfil.atiendeVirtual) {
                omitidas.push({ inicio: e.inicio, motivo: "modalidad" });
                continue;
            }
            if (e.modalidad === "PRESENCIAL" && !perfil.atiendePresencial) {
                omitidas.push({ inicio: e.inicio, motivo: "modalidad" });
                continue;
            }
            if (fin.getTime() > venceEn.getTime()) {
                omitidas.push({ inicio: e.inicio, motivo: "vigencia" });
                continue;
            }
            // SPEC-714 · misma regla que la creación unitaria (franjas/route.ts): no se publica
            // en un día que el profesional cerró. Sin esto, repetir/copiar sería la puerta hermana.
            if (await diasRepo.estaBloqueado(perfilId, diaBogota(inicio))) {
                omitidas.push({ inicio: e.inicio, motivo: "bloqueado" });
                continue;
            }
            if (await repo.existeSolapada(perfilId, inicio, fin)) {
                omitidas.push({ inicio: e.inicio, motivo: "solape" });
                continue;
            }
            await repo.crear({
                profesional: { connect: { id: perfilId } },
                inicio,
                fin,
                modalidad: e.modalidad,
                tomada: false,
            });
            creadas++;
        }
        return { creadas, omitidas };
    });
}

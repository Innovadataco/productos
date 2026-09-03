/**
 * SPEC-408 · Vista del PROFESIONAL sobre su propia verificación.
 *
 * CANDADO LEGAL (Ley 1918/2018 · 2375/2024 · brief §5): el profesional ve
 * SOLO la observación escrita del ítem que quedó `NO_CUMPLE`. Nunca ve
 * `resultado`, `checklist` como estructura completa, `revisadoPor`, `notaInterna`
 * ni `autorizacionArchivoUrl`. Esa es la evaluación de IDC sobre él, no un
 * dato suyo. Calidad tiene un candado que caza fugas de estos campos.
 */
import type { EstadoPerfilProfesional } from "@prisma/client";
import { VerificadorRepository } from "@/lib/dal/repositories/verificador-repository";
import { leerRequisitosVerificacion, type ItemChecklist } from "./requisitos";
import { AppError, ERROR_CODES } from "@/lib/errors";

export interface ObservacionParaProfesional {
    requisito: string; // nombre humano del ítem
    observacion: string;
}

export interface VistaProfesionalVerificacion {
    estadoPerfil: EstadoPerfilProfesional;
    puedeReenviar: boolean;
    observaciones: ObservacionParaProfesional[];
}

/**
 * Devuelve el estado del perfil y, si la última verificación quedó devuelta,
 * la lista de observaciones (nombre visible del ítem + texto). Nada más.
 */
export async function verificacionParaProfesional(usuarioId: string): Promise<VistaProfesionalVerificacion> {
    const perfil = await new VerificadorRepository().findPorUsuarioId(usuarioId);
    if (!perfil) {
        throw new AppError("Perfil profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    const observaciones: ObservacionParaProfesional[] = [];
    const ultima = perfil.verificaciones[0];
    // Brief §5-bis + veredicto CEO 16:2x: la devolución se escribe como
    // MAS_INFORMACION (no rechazo terminal). El profesional que corrige y
    // reenvía nunca queda "rechazado" ante la vista.
    if (ultima && ultima.resultado === "MAS_INFORMACION") {
        const requisitos = await leerRequisitosVerificacion();
        const checklist = (ultima.checklist ?? {}) as unknown as Record<string, ItemChecklist>;
        for (const r of requisitos) {
            const item = checklist[r.clave];
            if (item?.estado === "NO_CUMPLE" && item.observacion.trim()) {
                observaciones.push({ requisito: r.nombre, observacion: item.observacion.trim() });
            }
        }
    }
    // Puede reenviar si su perfil está en BORRADOR (típico tras rechazo) y la
    // autorización sigue cargada — el service verifica igual antes de mover.
    const puedeReenviar = perfil.estado === "BORRADOR" && Boolean(perfil.autorizacionArchivoUrl);
    return {
        estadoPerfil: perfil.estado,
        puedeReenviar,
        observaciones,
    };
}

/**
 * Vuelve a poner el perfil en `EN_REVISION` para que el Verificador lo vea.
 * Solo se permite desde `BORRADOR` con autorización cargada. No hay límite de
 * intentos (brief §5-bis: "el ciclo se repite sin límite").
 */
export async function reenviarParaVerificacion(usuarioId: string): Promise<void> {
    const repo = new VerificadorRepository();
    const perfil = await repo.findPorUsuarioId(usuarioId);
    if (!perfil) throw new AppError("Perfil profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);
    if (perfil.estado !== "BORRADOR") {
        throw new AppError(
            `Solo se puede reenviar desde BORRADOR (actual: ${perfil.estado})`,
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }
    if (!perfil.autorizacionArchivoUrl) {
        throw new AppError(
            "Falta subir la autorización firmada antes de reenviar",
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }
    await repo.cambiarEstadoPerfil(perfil.id, "EN_REVISION");
}

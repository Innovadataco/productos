/**
 * SPEC-408 · Vista del PROFESIONAL sobre su propia verificación.
 *
 * CANDADO LEGAL (Ley 1918/2018 · 2375/2024 · brief §5): el profesional ve
 * SOLO la observación escrita del ítem que quedó `NO_CUMPLE`. Nunca ve
 * `resultado`, `checklist` como estructura completa, `revisadoPor`, `notaInterna`
 * ni `autorizacionArchivoId`. Esa es la evaluación de IDC sobre él, no un
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
/**
 * SPEC-449 · los estados desde los que un profesional puede volver a pedir
 * verificación. **Fuente única de la vista y del service**: si se duplica, un
 * lado acepta y el otro no muestra el botón.
 *
 * `RECHAZADO` y `SUSPENDIDO` no están a propósito: son decisiones humanas de
 * IDC, no un plazo que se cumplió.
 */
const ORIGENES_QUE_PUEDEN_REENVIAR = ["BORRADOR", "VENCIDO"] as const;

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
    // SPEC-449: la bandera que decide si la PANTALLA muestra el botón usa la
    // MISMA lista de orígenes que el service (`ORIGENES_QUE_PUEDEN_REENVIAR`).
    // Estaban separadas: el service aceptaba `VENCIDO` y esta bandera no, así
    // que la API habría aceptado el reenvío y **el profesional vencido nunca
    // habría visto el botón** — el mismo defecto que la spec cierra, un piso
    // más arriba. Compartir la constante es lo que impide que vuelvan a
    // divergir; duplicar la condición es cómo nació el bug.
    const puedeReenviar =
        (ORIGENES_QUE_PUEDEN_REENVIAR as readonly string[]).includes(perfil.estado) &&
        Boolean(perfil.autorizacionArchivoId);
    return {
        estadoPerfil: perfil.estado,
        puedeReenviar,
        observaciones,
    };
}

/**
 * Vuelve a poner el perfil en `EN_REVISION` para que el Verificador lo vea.
 * No hay límite de intentos (brief §5-bis: "el ciclo se repite sin límite").
 *
 * **Orígenes permitidos: `BORRADOR` y `VENCIDO` (SPEC-449).**
 *
 * `VENCIDO` se sumó porque sin él ese estado es un **callejón sin salida**, y
 * SPEC-449 es justamente la spec que empieza a escribirlo. La cadena, verificada
 * antes de tocar nada: el profesional solo llega a `EN_REVISION` desde
 * `BORRADOR` (`perfil/route.ts:131`, `autorizacion/route.ts:98`), la cola del
 * Verificador lista **solo** `EN_REVISION` (`verificador-repository.ts:49`) y
 * `decidirVerificacion` aborta si el estado no es ese (`service.ts:203`). Sin
 * este cambio, cablear el reloj de vencimiento habría dejado a cada profesional
 * que se atrasa un día **fuera de la red y sin forma de volver** — un defecto
 * peor que el que la spec cierra.
 *
 * `RECHAZADO` y `SUSPENDIDO` **siguen sin poder**: son decisiones humanas de
 * IDC, no un plazo que se cumplió. El candado lo afirma en las dos direcciones.
 */
export async function reenviarParaVerificacion(usuarioId: string): Promise<void> {
    const repo = new VerificadorRepository();
    const perfil = await repo.findPorUsuarioId(usuarioId);
    if (!perfil) throw new AppError("Perfil profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);
    if (!(ORIGENES_QUE_PUEDEN_REENVIAR as readonly string[]).includes(perfil.estado)) {
        throw new AppError(
            `Solo se puede reenviar desde ${ORIGENES_QUE_PUEDEN_REENVIAR.join(" o ")} (actual: ${perfil.estado})`,
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }
    if (!perfil.autorizacionArchivoId) {
        throw new AppError(
            "Falta subir la autorización firmada antes de reenviar",
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }
    await repo.cambiarEstadoPerfil(perfil.id, "EN_REVISION");
}

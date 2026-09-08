import { prisma } from "@/lib/prisma";
import { actorActual } from "@/lib/auditoria-lectura/actor";
import { hashContenidoVisto } from "@/lib/acceso-codigo";
import type { CampoContenido } from "@/lib/reporte-texto-llaves";

/**
 * SPEC-584 (Fase 2) · Escritura de la auditoría de lectura del texto del reporte.
 * SPEC-594 (2026-09-08): la NOTIFICACIÓN al padre se ELIMINÓ de esta frontera.
 *
 * La frontera del descifrado (`descifrar-contenido.ts`) llama acá por CADA campo
 * descifrado que se devuelve a un lector. Se registra: quién (actor del hilo ALS),
 * qué campo, a qué contenido pertenece y el sha-256 del texto visto — NUNCA el
 * texto literal (decisión 1a del dueño, 2026-09-07).
 *
 * Por qué ya no se notifica al padre desde acá (bugs en vivo del dueño):
 *   - Las lecturas de ROLES INTERNOS (operador/admin/comité) son parte de la
 *     operación normal (clasificar, corregir) — cada render del detalle, cada
 *     corrección y cada lectura doble (texto + textoOriginal) le disparaba al
 *     padre un correo "un miembro de nuestro equipo leyó tu reporte". Regla del
 *     dueño: rol interno lee → CERO correos al padre; queda SOLO esta auditoría
 *     interna (`LecturaReporte`).
 *   - El acceso EXTERNO (profesional con código temporal) ya avisa al padre en el
 *     CANJE del código (`padre.reporte.acceso_canjeado`), que ES la acción real
 *     de revelado — no en cada lectura de la sesión ni al abrir pantallas.
 *
 * La escritura de la auditoría sigue siendo FAIL-LOUD: el descifrado ya exige la
 * base de datos, así que si no se puede dejar rastro la lectura no debe completarse
 * en silencio (decisión 7: "cada visualización genera registro").
 */

/** Datos del dueño del contenido, resueltos por la frontera antes de registrar. */
export interface DuenoContenido {
    reporteId?: string;
    eventoId?: string;
    /** Usuario autenticado dueño del reporte (null/undefined = reporte anónimo). */
    duenoUsuarioId?: string | null;
    /** Identificador reportado (para el correo al padre; sin PII del relato). */
    identificador?: string;
}

/**
 * Registra una lectura de un campo cifrado. Lanza si la auditoría no se puede
 * escribir (fail-loud). SPEC-594: NO envía notificación al padre — las
 * lecturas internas son operación normal (cero correos) y las externas ya se
 * avisaron en el canje del código.
 */
export async function registrarLecturaTexto(
    contenidoId: string,
    campo: CampoContenido,
    textoVisto: string,
    dueno: DuenoContenido
): Promise<void> {
    const actor = actorActual();
    await prisma.lecturaReporte.create({
        data: {
            contenidoId,
            campo,
            reporteId: dueno.reporteId ?? null,
            eventoId: dueno.eventoId ?? null,
            tipoActor: actor?.tipoActor ?? "PLATAFORMA",
            usuarioId: actor?.usuarioId ?? null,
            rol: actor?.rol ?? null,
            codigoAccesoId: actor?.codigoAccesoId ?? null,
            hashContenido: hashContenidoVisto(textoVisto),
            ip: actor?.ip ?? null,
            userAgent: actor?.userAgent ?? null,
        },
    });
}

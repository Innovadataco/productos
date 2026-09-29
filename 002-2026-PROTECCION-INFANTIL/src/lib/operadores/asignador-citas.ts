/**
 * SPEC-750 · Asignación de un OPERADOR a una cita CONFIRMADA — reusa el modelo de
 * asignación de casos (menor carga) PERO con SIMULTANEIDAD.
 *
 * El asignador de reportes (`asignador.ts`) cuenta CANTIDAD y no mira la hora: un caso no
 * tiene hora, una cita sí. Un operador no puede estar en dos reuniones a la misma hora. Acá
 * una cita solo se asigna a un operador **libre en su ventana** (franja + duración); entre
 * los libres, se elige por la estrategia existente.
 *
 * El operador asignado se persiste en `SolicitudCita.enlaceOperadorId` (SPEC-758). Esa columna
 * carga DOS estados, distinguidos por `enlacePublicadoEn`:
 *   · `enlaceOperadorId` no nulo + `enlacePublicadoEn` NULO  = ASIGNADO, sin publicar.
 *   · `enlaceOperadorId` no nulo + `enlacePublicadoEn` con fecha = ya publicó el enlace.
 * Es `SetNull` y NO es el registro de responsabilidad (ver el comentario del schema); el rastro
 * durable del hecho (incluido el MOMENTO de la asignación = `creadoEn` del AuditLog) vive en el
 * registro append-only, que sobrevive al `SetNull`.
 *
 * Acceso a datos SOLO por el repositorio (Q-3): nada de `@/lib/prisma` acá.
 */
import type { EstadoSolicitudCita, Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { obtenerConfigAsignacion, seleccionarOperador, type OperadorCandidato } from "./asignador";
import { metadatosHecho } from "./hecho-sesion-tipos";

// El solape puro vive en `simultaneidad.ts` (unit sin infra); se re-exporta.
export { ventanasSolapan } from "./simultaneidad";

/** Estados en los que una cita OCUPA la agenda del operador (hay sesión programada). */
const ESTADOS_OCUPAN_OPERADOR: EstadoSolicitudCita[] = ["CONFIRMADA"];

export type ResultadoAsignacionCita =
    | { asignado: true; operadorId: string }
    | { asignado: false; razon: string };

export async function asignarOperadorACita(
    solicitudId: string,
    tx?: Prisma.TransactionClient,
): Promise<ResultadoAsignacionCita> {
    const repo = new SolicitudCitaRepository(tx);

    const cita = await repo.findParaAsignacion(solicitudId);
    if (!cita) return { asignado: false, razon: "Cita no encontrada" };
    if (cita.enlaceOperadorId) return { asignado: false, razon: "La cita ya tiene operador asignado" };
    if (cita.estado !== "CONFIRMADA") {
        return { asignado: false, razon: `Estado ${cita.estado} no admite asignación de sesión` };
    }

    const { inicio: nuevaInicio, fin: nuevaFin } = cita.franja;
    const ahora = new Date();

    const operadores = await new UsuarioRepository(tx).findOperadoresActivosConPerfil();
    if (operadores.length === 0) return { asignado: false, razon: "No hay operadores activos" };

    const { cupoSesionesDefault, estrategia } = await obtenerConfigAsignacion(tx);

    // Filtro de SIMULTANEIDAD: descarta a quien ya tenga una cita solapada en la ventana.
    // La CARGA es la de SESIONES vigentes (corte por fecha) y el cupo es el de SESIONES —libro
    // propio, separado de `cupoMaximo` (que significa CASOS). El filtro POR CUPO lo aplica
    // seleccionarOperador (invariante estructural, SPEC-779), no este llamador.
    const libres: OperadorCandidato[] = [];
    for (const op of operadores) {
        if (!op.perfilOperador) continue;
        if (await repo.operadorTieneSolape(op.id, nuevaInicio, nuevaFin, ESTADOS_OCUPAN_OPERADOR)) continue;
        libres.push({
            id: op.id,
            email: op.email,
            nombre: op.nombre,
            cupo: cupoSesionesDefault,
            cargaActual: await repo.contarSesionesVigentesDeOperador(op.id, ESTADOS_OCUPAN_OPERADOR, ahora),
        });
    }

    if (libres.length === 0) {
        // Contrato §5: sin operador libre en la ventana → NO se asigna; sube al admin como capacidad.
        return { asignado: false, razon: "Sin operador libre en la ventana" };
    }

    const elegido = seleccionarOperador(libres, estrategia);
    if (!elegido) {
        // Todos los libres están en su cupo de SESIONES → NO se asigna; sube al admin como capacidad.
        return { asignado: false, razon: "Sin operador con cupo de sesiones disponible" };
    }

    await repo.asignarOperador(solicitudId, elegido.id);

    await logAudit({
        accion: "OPERADOR_ASIGNADO",
        tipoRecurso: "SolicitudCita",
        recursoId: solicitudId,
        usuarioId: elegido.id,
        // Forma tipada del HECHO (imposible-por-construcción meter url); discriminador para BI.
        metadatos: metadatosHecho("cita_asignada"),
        tx,
    });

    return { asignado: true, operadorId: elegido.id };
}

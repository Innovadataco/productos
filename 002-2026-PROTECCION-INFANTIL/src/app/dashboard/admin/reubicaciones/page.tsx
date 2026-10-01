import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { COPY_MOTIVO_REUBICACION } from "@/lib/profesional/cita/reubicacion-motivo-copy";
import { datosPantallaReubicacion, type CitaConCandidatos } from "@/lib/profesional/cita/reubicacion-pantalla";
import { ReubicarAccion, type CandidatoVista } from "@/components/modules/admin/ReubicarAccion";

/**
 * SPEC-814/832 (T7 de 790) · La pantalla «Citas en espera de reubicación». La COLA es la cara PRINCIPAL
 * (la mediana de candidatos medida en prod es 0: lo común es que una cita confirmada de un profesional
 * inhabilitado NO tenga a quién ir). Interno, voz USTED, ámbar (hay trabajo; no es alarma roja). [NORMA]
 * Res. 3100 art. 19/8.5.
 *
 * COMPUERTA por rol EN LA PÁGINA (servidor), no en el menú: esconder o mostrar el ítem no es el muro.
 * NO hay control de CANCELAR en ningún estado (contrato de la forma). El DTO viene minimizado del servicio.
 *
 * SPEC-832 pieza 2: ya cablea el «a QUIÉN va» (candidatos §1-bis + «Reasignar a {B}», `ReubicarAccion`).
 * Cuando una cita NO tiene candidatos —el caso mayoritario— muestra el estado §2 con su salida (seguir en
 * la cola, que re-calza sola), nunca un vacío mudo.
 */

// Copy de Diseño (FORMA v1.4 §2, commit dfcc2f4). «disponible» cubre el motivo real (el turno publicado),
// no afirma escasez; esa línea «no se toca» (verificada por el CEO).
const COPY_SIN_CANDIDATO =
    "No hay un profesional habilitado disponible para esta cita todavía. No se puede reasignar automáticamente — esta cita no se cancela.";

const fechaBogota = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});
const horaBogota = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });

function franjaLegible(inicio: Date, fin: Date): string {
    return `${fechaBogota.format(inicio)} – ${horaBogota.format(fin)}`;
}

/** Los candidatos del read-model, con los turnos ya ETIQUETADOS en servidor (Date no cruza bien el borde RSC). */
function aVistaCliente(fila: CitaConCandidatos): CandidatoVista[] {
    return fila.candidatos.map((c) => ({
        profesionalId: c.profesionalId,
        nombreVisible: c.nombreVisible,
        especialidadesCompartidas: c.especialidadesCompartidas,
        especialidadesNoCubiertas: c.especialidadesNoCubiertas,
        turnos: c.turnos.map((t) => ({ id: t.id, etiqueta: franjaLegible(t.inicio, t.fin) })),
    }));
}

function TarjetaCita({ fila }: { fila: CitaConCandidatos }) {
    const motivo = COPY_MOTIVO_REUBICACION[fila.deQuienSale.motivoCodigo];
    const candidatos = aVistaCliente(fila);
    // Caja de atención ÁMBAR del Sistema de Diseño (token `ambar` + `text-estado-ambar`); nunca crudo (SPEC-483).
    return (
        <li className="rounded-xl border border-ambar/30 bg-ambar/10 p-4 text-estado-ambar">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{fila.deQuienSale.nombre}</p>
                <span className="font-mono text-xs">{fila.citaRef}</span>
            </div>
            <p className="mt-1 text-sm font-medium">{motivo.titulo}</p>
            <p className="text-sm">{motivo.detalle}</p>
            {fila.deQuienSale.especialidades.length > 0 ? (
                <p className="mt-1 text-sm">Especialidades: {fila.deQuienSale.especialidades.join(" · ")}</p>
            ) : null}
            <dl className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                <div>
                    <dt className="inline font-medium">Franja: </dt>
                    <dd className="inline">{franjaLegible(fila.cita.inicio, fila.cita.fin)}</dd>
                </div>
                <div>
                    <dt className="inline font-medium">Modalidad: </dt>
                    <dd className="inline">{fila.cita.modalidad === "VIRTUAL" ? "Virtual" : "Presencial"}</dd>
                </div>
                {fila.cita.ciudad ? (
                    <div>
                        <dt className="inline font-medium">Ciudad: </dt>
                        <dd className="inline">{fila.cita.ciudad}</dd>
                    </div>
                ) : null}
            </dl>
            {candidatos.length > 0 ? (
                <ReubicarAccion citaId={fila.citaId} nombreSaliente={fila.deQuienSale.nombre} candidatos={candidatos} />
            ) : (
                // Estado §2 — camino PRINCIPAL (mediana 0). Con salida: la cita sigue en la cola, que re-calza
                // sola cuando se publique un turno. No es un vacío mudo, y nunca «cancelar».
                <p className="mt-3 border-t border-ambar/30 pt-3 text-sm font-medium">{COPY_SIN_CANDIDATO}</p>
            )}
        </li>
    );
}

export default async function ReubicacionesPage() {
    const acceso = await verificarAccesoPagina("operadores");
    if (!acceso.permitido || acceso.rol !== "ADMIN") {
        redirect(acceso.rol === "COMITE_VALIDACION" ? "/dashboard/admin/comite" : "/dashboard/admin/bandeja");
    }
    const cola = await datosPantallaReubicacion();

    return (
        <section className="mx-auto max-w-3xl">
            {/* Título de la FORMA §2.1. Sin color crudo: hereda la tinta por defecto del tema admin. */}
            <h1 className="text-xl font-semibold">Citas en espera de reubicación</h1>
            {cola.length === 0 ? (
                <p className="mt-4 text-sm">No hay citas en espera de reubicación.</p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {cola.map((fila) => (
                        <TarjetaCita key={fila.citaId} fila={fila} />
                    ))}
                </ul>
            )}
        </section>
    );
}

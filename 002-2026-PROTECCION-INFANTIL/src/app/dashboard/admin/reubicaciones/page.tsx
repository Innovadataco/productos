import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { citasPorReubicar, type CitaPorReubicar } from "@/lib/profesional/cita/reubicacion-cola";
import { COPY_MOTIVO_REUBICACION } from "@/lib/profesional/cita/reubicacion-motivo-copy";

/**
 * SPEC-814 (T7 de 790) · La COLA «Citas en espera de reubicación» — la cara PRINCIPAL de la pantalla
 * de reubicación (la mediana de candidatos medida en prod es 0: lo común es que una cita confirmada de
 * un profesional inactivo NO tenga a quién ir). Interno, voz USTED, ámbar (hay trabajo; no es alarma
 * roja). [NORMA] Res. 3100 art. 19/8.5.
 *
 * NO hay control de CANCELAR en ningún estado (contrato de la forma: continuidad es reubicar, no
 * cancelar). El DTO ya viene minimizado del servicio (sin relato ni PII de la familia).
 *
 * PENDIENTE (declarado, no inventado):
 *  · El «a QUIÉN va» (candidatos §1-bis: comparte / no cubre, acción «Reasignar a {B}») se cabla sobre
 *    el matcher SPEC-832 (detrás de 825). Hasta entonces la pantalla es la COLA, que es justamente la
 *    cara principal.
 *  · El copy de los dos motivos vive en `reubicacion-motivo-copy.ts` (FORMA v1.5 §1-ter): leen
 *    DISTINTO a propósito (acción distinta), y un candado impide que se «unifiquen».
 */

const fechaBogota = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

function franjaLegible(inicio: Date, fin: Date): string {
    const horaFin = new Intl.DateTimeFormat("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
    }).format(fin);
    return `${fechaBogota.format(inicio)} – ${horaFin}`;
}

function TarjetaCita({ fila }: { fila: CitaPorReubicar }) {
    const motivo = COPY_MOTIVO_REUBICACION[fila.deQuienSale.motivoCodigo];
    // Caja de atención ÁMBAR del Sistema de Diseño (token `ambar` + texto `text-estado-ambar`, el
    // único ámbar AA como texto); nunca crudo de Tailwind (candado SPEC-483).
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
            {/* SPEC-832: acá va el «a quién va» (candidatos que comparten/ no cubren + «Reasignar a {B}»)
                o el estado «sin candidato disponible» (FORMA §2). Se cabla sobre el matcher. NUNCA un
                control de cancelar. */}
        </li>
    );
}

export default async function ReubicacionesPage() {
    const acceso = await verificarAccesoPagina("operadores");
    if (!acceso.permitido || acceso.rol !== "ADMIN") {
        redirect(acceso.rol === "COMITE_VALIDACION" ? "/dashboard/admin/comite" : "/dashboard/admin/bandeja");
    }
    const cola = await citasPorReubicar();

    return (
        <section className="mx-auto max-w-3xl">
            {/* Título de la FORMA §2.1. Sin color crudo: hereda la tinta por defecto del tema admin. */}
            <h1 className="text-xl font-semibold">Citas en espera de reubicación</h1>
            {cola.length === 0 ? (
                <p className="mt-4 text-sm">No hay citas en espera de reubicación.</p>
            ) : (
                <ul className="mt-4 space-y-3">
                    {cola.map((fila) => (
                        <TarjetaCita key={fila.citaRef} fila={fila} />
                    ))}
                </ul>
            )}
        </section>
    );
}

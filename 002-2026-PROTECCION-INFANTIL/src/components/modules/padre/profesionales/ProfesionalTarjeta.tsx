/**
 * SPEC-392 (L3) · tarjeta del directorio del padre.
 *
 * La TARIFA por delante (regla dura del brief: el padre tiene que saber cuánto
 * cuesta antes de reservar). El sello "Nuevo en la red" reemplaza las
 * estrellas — el brief pide no mostrarlas hasta que haya varias calificaciones,
 * y en L3 todavía no existen encuestas (llegan en L6): TODOS aparecen «Nuevo
 * en la red».
 */
import Link from "next/link";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

/**
 * SPEC-392 · H-2 · protección de tipo, no convención.
 *
 * La tarjeta consume el DTO público del DAL. Si alguien intenta pasarle un
 * `email`/`telefono`/`numeroTarjetaProfesional`, el compilador rechaza — el
 * DTO no los tiene por diseño (ver `perfil-profesional.ts` · `PerfilPublicoDTO`).
 */
export type ProfesionalTarjetaData = PerfilPublicoDTO;

/** Formato oficial COP sin decimales — "$120.000". */
const CURRENCY_COP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

function modalidadesTexto(virtual: boolean, presencial: boolean): string {
    if (virtual && presencial) return "Virtual · Presencial";
    if (virtual) return "Virtual";
    if (presencial) return "Presencial";
    return "";
}

export function ProfesionalTarjeta({
    p,
    hrefBase,
    queryString,
}: {
    p: ProfesionalTarjetaData;
    /** Prefijo del enlace sin id ni query. */
    hrefBase: string;
    /** Query string ya armado (`?u=…&pres=…`), o cadena vacía. */
    queryString: string;
}) {
    const modal = modalidadesTexto(p.atiendeVirtual, p.atiendePresencial);
    return (
        <Link
            href={`${hrefBase}/${p.id}${queryString}`}
            className="glass rounded-2xl p-5 flex flex-col gap-3 hover:shadow-lg transition"
            aria-label={`Ver perfil de ${p.nombreVisible}`}
        >
            <div className="flex items-center gap-3">
                {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={p.fotoUrl}
                        alt=""
                        className="h-14 w-14 rounded-full object-cover bg-cielo/15 dark:bg-cielo/30"
                    />
                ) : (
                    <div
                        className="h-14 w-14 rounded-full bg-cielo/15 dark:bg-cielo/30 flex items-center justify-center text-cielo dark:text-cielo text-lg font-semibold"
                        aria-hidden="true"
                    >
                        {p.nombreVisible.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-body truncate">{p.nombreVisible}</h3>
                    <p className="text-xs text-subtle truncate">{p.tituloProfesional}</p>
                </div>
            </div>

            {/* Tarifa por delante (regla del brief: antes de reservar). */}
            <div className="rounded-xl bg-cielo/10 dark:bg-cielo/10 p-3">
                <p className="text-xs uppercase tracking-wide text-cielo dark:text-cielo">
                    Consulta
                </p>
                <p className="text-2xl font-bold text-cielo dark:text-cielo">
                    {CURRENCY_COP.format(p.tarifaConsultaCOP)}
                    <span className="text-sm font-normal text-cielo dark:text-cielo"> · {p.duracionMinutos} min</span>
                </p>
            </div>

            <ul className="text-xs text-muted space-y-1">
                {p.ciudad && <li>📍 {p.ciudad.nombre}</li>}
                {modal && <li>💻 {modal}</li>}
                {p.especialidades.length > 0 && <li>🎯 {p.especialidades.slice(0, 3).join(" · ")}</li>}
                <li>🎓 {p.aniosExperiencia} años de experiencia</li>
                {p.emiteFactura && <li>🧾 Emite factura</li>}
            </ul>

            {/* "Nuevo en la red" (candado del brief: sin varias calificaciones,
                las estrellas hunden a alguien injustamente). En L3 SIEMPRE. */}
            <div className="mt-auto pt-2 border-t border-cielo/20 dark:border-cielo/40">
                <span className="inline-flex items-center gap-1 rounded-full bg-ambar/10 dark:bg-ambar/10 px-3 py-1 text-xs font-medium text-ambar dark:text-ambar">
                    ✨ Nuevo en la red
                </span>
            </div>
        </Link>
    );
}

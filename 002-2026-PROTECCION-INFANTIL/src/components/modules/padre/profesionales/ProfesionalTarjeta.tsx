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
    precioPrimeraCitaCOP,
}: {
    p: ProfesionalTarjetaData;
    /** Prefijo del enlace sin id ni query. */
    hrefBase: string;
    /** Query string ya armado. Desde SPEC-440 solo trae IDs opacos
     *  (`?expedienteId=…&heredarDe=…`); presentación y urgencia van
     *  por `sessionStorage`, no por URL (I-306). */
    queryString: string;
    /**
     * SPEC-441: el precio que se COBRA por la primera cita, del mismo parámetro
     * que lee la ficha. La tarjeta pintaba `tarifaConsultaCOP` —informativa, de
     * la 2ª cita en adelante— y la ficha el estándar: el padre veía un número
     * acá y otro distinto al entrar.
     */
    precioPrimeraCitaCOP: number;
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
                        className="h-16 w-16 rounded-full object-cover bg-cielo/15 dark:bg-cielo/30"
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
                    <h3 className="text-lg font-semibold text-body truncate">{p.nombreVisible}</h3>
                    {/* SPEC-441: fuera el nombre TÉCNICO del título — Jelkin:
                        «el padre eso no lo entiende». En su lugar, las
                        especialidades, que ya están en lenguaje de familia.
                        El título sigue en la ficha, donde hay espacio para
                        el detalle. */}
                    {p.especialidades.length > 0 && (
                        <p className="text-xs text-subtle truncate">
                            {p.especialidades.slice(0, 3).join(" · ")}
                            {p.especialidades.length > 3 ? ` +${p.especialidades.length - 3}` : ""}
                        </p>
                    )}
                </div>
            </div>

            {/* SPEC-441 · el precio está, claro y sin letra chica, pero NO es el
                protagonista: un padre que busca ayuda para su hijo no está
                comprando, está eligiendo en quién confiar. Y es el número que
                se COBRA —el estándar de la primera cita—, el mismo que muestra
                la ficha. Antes decía «Consulta» sobre la tarifa informativa. */}
            <div className="rounded-xl bg-cielo/10 dark:bg-cielo/10 px-3 py-2">
                <p className="text-xs text-cielo dark:text-cielo">
                    Primera cita{" "}
                    <span className="font-semibold">{CURRENCY_COP.format(precioPrimeraCitaCOP)}</span>
                    <span className="text-muted"> · {p.duracionMinutos} min</span>
                </p>
            </div>

            <ul className="text-xs text-muted space-y-1">
                {/* SPEC-441 · antes era `p.ciudad &&`, y el fallback del DAL es un
                    objeto —siempre verdadero—, así que podía pintar un pin con
                    el nombre vacío. Ahora se guarda sobre el NOMBRE, se dice de
                    quién es la ubicación, y el país solo aparece si existe: no
                    se inventa. */}
                {p.ciudad?.nombre && (
                    <li>
                        📍 Atiende desde {p.ciudad.nombre}
                        {p.ciudad.pais ? `, ${p.ciudad.pais}` : ""}
                    </li>
                )}
                {modal && <li>💻 {modal}</li>}
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

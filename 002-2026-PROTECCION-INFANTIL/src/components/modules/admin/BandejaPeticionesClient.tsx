"use client";

/**
 * SPEC-824 · Render de la BANDEJA de peticiones de soporte (operador/admin). Recibe el DTO ya armado por
 * `listarBandejaPeticiones` (el servidor calcula; esto solo pinta). Herramienta 100% INTERNA, voz USTED (787).
 *
 * 🔒 PRIVACIDAD: pinta SOLO metadata del DTO (categoría, acción, relojes, estado). El DTO no trae «de quién»
 * ni contenido, así que no puede revelar qué se pidió borrar.
 * 🕒 El PLAZO SÍ se muestra acá (interno del operador) — contracara de que el padre no lo ve.
 * 🟠 «Vencida» NO es un estado cerrado: el plazo venció, la OBLIGACIÓN no (responder tarde REDUCE el
 *    incumplimiento; ignorar lo AGRAVA). Por eso va en ÁMBAR FIRME y empuja a actuar — nunca rubí (D-120),
 *    nunca verde/gris, nunca estilo de caso cerrado. El orden por vencimiento lo pone el servicio.
 *
 * Copy VERBATIM de Diseño (SPEC-824).
 */
import type { BandejaPeticionesDto, PeticionBandejaDto } from "@/lib/soporte/bandeja-peticiones.service";
import type { EstadoPeticionServicio } from "@/lib/soporte/estado-efectivo-peticion";

const COPY_BANDEJA = {
    legal: {
        titulo: "Con término de ley",
        desc: "Datos personales y Pagos/cobros. Plazo legal para responder; atienda primero las que vencen antes.",
    },
    otras: {
        titulo: "Sin plazo de ley",
        desc: "Citas, servicio y otras. No corren término, pero igual se responden.",
    },
    cols: { solicitud: "Solicitud", recibida: "Recibida", vence: "Vence", estado: "Estado" },
    vacio: "No hay solicitudes abiertas.",
    motivo: {
        DATOS_PERSONALES: "Datos personales",
        PAGO_O_COBRO: "Pago o cobro",
        CITA: "Cita",
        SERVICIO_PLATAFORMA: "Servicio de la plataforma",
        OTRA: "Otra solicitud",
    } as Record<string, string>,
    accion: { CONSULTA: "Consulta de datos", RECTIFICACION: "Rectificación", SUPRESION: "Supresión" } as Record<string, string>,
    estado: {
        ABIERTA: "Abierta — en término",
        VENCIDA_SIN_RESOLVER: "Vencida — atender de inmediato",
        RESUELTA_TARDE: "Resuelta (fuera de plazo)",
        RESUELTA: "Resuelta",
    } as Record<EstadoPeticionServicio, string>,
} as const;

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const fmt = (iso: string) => FECHA.format(new Date(iso));

/** 🟠 «Vencida» = ámbar firme + énfasis (empuja a actuar). Lo demás, neutro. NUNCA rubí/verde/gris. */
function EstadoCelda({ estado }: { estado: EstadoPeticionServicio }) {
    const vencida = estado === "VENCIDA_SIN_RESOLVER";
    return (
        <span
            className={
                vencida
                    ? "inline-flex rounded-full bg-ambar/15 px-3 py-1 text-xs font-semibold text-ambar"
                    : "text-xs text-muted"
            }
        >
            {COPY_BANDEJA.estado[estado] ?? estado}
        </span>
    );
}

function Fila({ p }: { p: PeticionBandejaDto }) {
    return (
        <tr className="border-t border-tinta/10">
            <td className="py-2 pr-3">
                <span className="text-sm text-body">{COPY_BANDEJA.motivo[p.motivo] ?? p.motivo}</span>
                {p.tipoHabeas && <span className="text-xs text-muted"> · {COPY_BANDEJA.accion[p.tipoHabeas] ?? p.tipoHabeas}</span>}
                <span className="block cifra text-xs text-muted">#{p.id}</span>
            </td>
            <td className="py-2 pr-3 cifra text-xs text-muted">{fmt(p.creadoEn)}</td>
            <td className="py-2 pr-3 cifra text-xs text-body">{fmt(p.venceEn)}</td>
            <td className="py-2">
                <EstadoCelda estado={p.estado} />
            </td>
        </tr>
    );
}

function Grupo({ titulo, desc, items, marca }: { titulo: string; desc: string; items: PeticionBandejaDto[]; marca: string }) {
    if (items.length === 0) return null;
    return (
        <section data-grupo={marca}>
            <h2 className="text-sm font-semibold text-body">{titulo}</h2>
            <p className="mt-0.5 text-xs text-muted">{desc}</p>
            <table className="mt-2 w-full text-left">
                <thead>
                    <tr className="text-xs font-medium text-subtle">
                        <th className="pb-1 pr-3 font-medium">{COPY_BANDEJA.cols.solicitud}</th>
                        <th className="pb-1 pr-3 font-medium">{COPY_BANDEJA.cols.recibida}</th>
                        <th className="pb-1 pr-3 font-medium">{COPY_BANDEJA.cols.vence}</th>
                        <th className="pb-1 font-medium">{COPY_BANDEJA.cols.estado}</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((p) => (
                        <Fila key={p.id} p={p} />
                    ))}
                </tbody>
            </table>
        </section>
    );
}

export function BandejaPeticionesClient({ data }: { data: BandejaPeticionesDto }) {
    const vacio = data.legales.length === 0 && data.otras.length === 0;
    return (
        <div className="space-y-6" data-bandeja-peticiones>
            {vacio && <p className="text-sm text-muted">{COPY_BANDEJA.vacio}</p>}
            {/* Lo legal SEPARADO y PRIMERO. */}
            <Grupo titulo={COPY_BANDEJA.legal.titulo} desc={COPY_BANDEJA.legal.desc} items={data.legales} marca="legales" />
            <Grupo titulo={COPY_BANDEJA.otras.titulo} desc={COPY_BANDEJA.otras.desc} items={data.otras} marca="otras" />
        </div>
    );
}

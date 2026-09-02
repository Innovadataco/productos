"use client";

/**
 * A-73 (SPEC-367) · Tarjeta de una persona del círculo.
 *
 * Verde = tranquila · ámbar = necesita atención · gris = en pausa. NUNCA rojo
 * (el rojo del semáforo interno se pinta ámbar con texto más fuerte).
 * Sin jerga: no se dice "identificador", "etiqueta" ni "tipo".
 *
 * El texto es neutro en género a propósito: el sistema guarda nombre y
 * parentesco, no el género, y no se infiere de un nombre.
 */
import {
    desdeCuando,
    iniciales,
    nombreVisible,
    textoEstado,
    tonoDeContacto,
    type Contacto,
} from "./tipos";

type Props = {
    contacto: Contacto;
    onVerDetalle: (contacto: Contacto) => void;
    onAgregarDato: (contacto: Contacto) => void;
    onPausar: (contacto: Contacto) => void;
    onQuitar: (contacto: Contacto) => void;
    ocupado?: boolean;
};

export function TarjetaPersona({ contacto, onVerDetalle, onAgregarDato, onPausar, onQuitar, ocupado }: Props) {
    const tono = tonoDeContacto(contacto);
    const nombre = nombreVisible(contacto);
    const enAtencion = tono === "ambar";
    const enPausa = tono === "gris";
    const tieneReportes = contacto.totalReportes > 0;

    const marco = enAtencion
        ? "border-ambar/45 shadow-[0_6px_18px_rgb(var(--ambar-rgb)/0.10)]"
        : "border-tinta/10";
    const fondo = enPausa ? "bg-papel" : "bg-white dark:bg-tinta/20";

    return (
        <article className={`flex flex-col gap-3 rounded-2xl border p-4 ${marco} ${fondo}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span
                        aria-hidden="true"
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold ${
                            enAtencion
                                ? "bg-ambar/15 text-ambar ring-2 ring-ambar"
                                : enPausa
                                    ? "bg-tinta/10 text-muted"
                                    : "bg-pino/15 text-pino"
                        }`}
                    >
                        {iniciales(nombre)}
                    </span>
                    <div className="min-w-0">
                        <div className="truncate font-semibold text-body">{nombre}</div>
                        {contacto.parentesco && <div className="truncate text-sm text-muted">{contacto.parentesco}</div>}
                    </div>
                </div>
                <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        enAtencion
                            ? "bg-ambar/15 text-ambar"
                            : enPausa
                                ? "bg-tinta/10 text-muted"
                                : "bg-pino/12 text-pino"
                    }`}
                >
                    {textoEstado(contacto)}
                </span>
            </div>

            {contacto.identificadores.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Sus datos en internet</span>
                    <ul className="flex flex-wrap gap-1.5">
                        {contacto.identificadores.map((i) => (
                            <li
                                key={i.id}
                                className={`rounded-lg px-2 py-1 text-sm ${
                                    i.activo ? "bg-papel text-body" : "bg-papel/60 text-muted"
                                }`}
                            >
                                <b className="font-semibold">{i.valor}</b>
                                {i.plataforma && <span className="text-muted"> · {i.plataforma.nombre}</span>}
                                {!i.activo && <span className="text-muted"> · en pausa</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="text-sm text-muted">
                {enPausa ? "En pausa: no la estamos vigilando." : `La vigilas desde el ${desdeCuando(contacto.creadoEn)}.`}
                {!enPausa && !tieneReportes && " Todo tranquilo."}
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                {tieneReportes && (
                    <button
                        type="button"
                        onClick={() => onVerDetalle(contacto)}
                        className="inline-flex h-9 items-center rounded-xl bg-pino px-3 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                        Ver de qué se trata
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onAgregarDato(contacto)}
                    disabled={ocupado}
                    className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold text-pino transition hover:bg-pino/10 disabled:opacity-50"
                >
                    + Otro dato
                </button>
                <span className="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onPausar(contacto)}
                        disabled={ocupado}
                        className="inline-flex h-9 items-center rounded-xl px-2.5 text-sm text-muted transition hover:text-body disabled:opacity-50"
                    >
                        {enPausa ? "Reanudar" : "Pausar"}
                    </button>
                    <button
                        type="button"
                        onClick={() => onQuitar(contacto)}
                        disabled={ocupado}
                        className="inline-flex h-9 items-center rounded-xl px-2.5 text-sm text-muted transition hover:text-body disabled:opacity-50"
                    >
                        Quitar
                    </button>
                </span>
            </div>
        </article>
    );
}

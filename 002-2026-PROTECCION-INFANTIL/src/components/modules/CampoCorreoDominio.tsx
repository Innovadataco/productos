"use client";

import { useState } from "react";
import {
    ATAJOS_DOMINIO,
    sugerirDominioCorreo,
    aplicarSugerenciaDominio,
    partirEntradaCorreo,
    limpiarDominioLibre,
} from "@/lib/email-typo";

/**
 * 3003 — campo de correo con dominio por ELECCIÓN (no por tecleo): la persona
 * escribe su nombre de usuario a la izquierda y elige el dominio a la derecha
 * (chips de un toque o «Otro…» para dominios institucionales). El typo de
 * dominio es imposible por diseño.
 *
 * Inteligencia (mejores prácticas):
 * - El «@» es estructural: si escriben o pegan un correo COMPLETO, o con «@@»,
 *   o con espacios, el campo lo parsea y corrige solo (partirEntradaCorreo) y
 *   auto-selecciona el chip si el dominio es conocido.
 * - «Quedará: …» muestra el correo final en vivo: la persona ve exactamente
 *   qué quedará registrado antes de Continuar.
 * - En modo «Otro» sigue activa la sugerencia de typo (ámbar, un toque) y el
 *   servidor aplica la misma regla como barrera de verdad al enviar.
 */
export function CampoCorreoDominio({
    label,
    placeholderLocal = "tucorreo",
    value,
    onChange,
}: {
    label: string;
    placeholderLocal?: string;
    value: string;
    onChange: (correo: string) => void;
}) {
    // Estado derivado del valor externo solo como punto de partida; a partir de
    // ahí el componente es dueño de la descomposición (la persona puede cambiar
    // de dominio sin reescribir la parte local).
    const [local, setLocal] = useState(() => partirEntradaCorreo(value).local);
    const [dominio, setDominio] = useState(() => {
        const d = partirEntradaCorreo(value).dominio;
        return d && ATAJOS_DOMINIO.includes(d) ? d : "";
    });
    const [otroActivo, setOtroActivo] = useState(() => {
        const d = partirEntradaCorreo(value).dominio;
        return !!d && !ATAJOS_DOMINIO.includes(d);
    });
    const [dominioLibre, setDominioLibre] = useState(() => {
        const d = partirEntradaCorreo(value).dominio;
        return d && !ATAJOS_DOMINIO.includes(d) ? d : "";
    });

    const dominioEfectivo = otroActivo ? dominioLibre : dominio;
    const correoCompleto = local && dominioEfectivo ? `${local}@${dominioEfectivo}` : "";
    const sugerencia = otroActivo && dominioLibre.length >= 4 ? sugerirDominioCorreo(`x@${dominioLibre}`) : null;

    const emitir = (nuevoLocal: string, nuevoDominio: string) => {
        setLocal(nuevoLocal);
        onChange(nuevoLocal && nuevoDominio ? `${nuevoLocal}@${nuevoDominio}` : "");
    };

    const cambiarLocal = (raw: string) => {
        // Pegó/escribió un correo completo (con @): parsear y reenfocar el dominio.
        const { local: nuevoLocal, dominio: dominioPegado } = partirEntradaCorreo(raw);
        if (dominioPegado) {
            if (ATAJOS_DOMINIO.includes(dominioPegado)) {
                setDominio(dominioPegado);
                setOtroActivo(false);
                setDominioLibre("");
                emitir(nuevoLocal, dominioPegado);
            } else {
                setDominio("");
                setOtroActivo(true);
                setDominioLibre(dominioPegado);
                emitir(nuevoLocal, dominioPegado);
            }
        } else {
            emitir(nuevoLocal, dominioEfectivo);
        }
    };

    const elegirAtajo = (atajo: string) => {
        setDominio(atajo);
        setOtroActivo(false);
        setDominioLibre("");
        emitir(local, atajo);
    };

    const activarOtro = () => {
        setDominio("");
        setOtroActivo(true);
        emitir(local, dominioLibre);
    };

    const cambiarDominioLibre = (raw: string) => {
        const limpio = limpiarDominioLibre(raw);
        setDominioLibre(limpio);
        emitir(local, limpio);
    };

    return (
        <div className="space-y-2">
            <span className="block text-sm font-medium text-body">{label}</span>
            <div className="flex items-stretch gap-2">
                <input
                    type="text"
                    inputMode="email"
                    placeholder={placeholderLocal}
                    autoComplete="email"
                    aria-label={`${label}: nombre de usuario`}
                    value={local}
                    onChange={(e) => cambiarLocal(e.target.value)}
                    className="w-full min-w-0 flex-1 rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input ring-accent-input"
                />
                <span className="flex items-center text-sm text-muted" aria-hidden="true">@</span>
                {otroActivo ? (
                    <input
                        type="text"
                        inputMode="url"
                        placeholder="tudominio.com"
                        aria-label="Dominio del correo"
                        value={dominioLibre}
                        onChange={(e) => cambiarDominioLibre(e.target.value)}
                        className="w-40 min-w-0 rounded-xl px-3 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input ring-accent-input"
                    />
                ) : (
                    <span className="flex items-center rounded-xl glass-input px-3 py-3 text-sm text-body">
                        {dominio || "elige el dominio"}
                    </span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Dominio:</span>
                {ATAJOS_DOMINIO.map((atajo) => (
                    <button
                        key={atajo}
                        type="button"
                        aria-pressed={!otroActivo && dominio === atajo}
                        onClick={() => elegirAtajo(atajo)}
                        className={`rounded-full px-3 py-1 text-xs transition ${
                            !otroActivo && dominio === atajo
                                ? "accent-gradient font-semibold text-white"
                                : "glass text-body hover:opacity-80"
                        }`}
                    >
                        {atajo}
                    </button>
                ))}
                <button
                    type="button"
                    aria-pressed={otroActivo}
                    onClick={activarOtro}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                        otroActivo
                            ? "accent-gradient font-semibold text-white"
                            : "glass text-body hover:opacity-80"
                    }`}
                >
                    Otro…
                </button>
            </div>

            {sugerencia && (
                <button
                    type="button"
                    onClick={() => cambiarDominioLibre(sugerencia)}
                    className="block w-full rounded-xl bg-ambar/10 px-3 py-2 text-left text-xs text-estado-ambar transition hover:opacity-80"
                >
                    ¿Quisiste decir <span className="font-semibold">{aplicarSugerenciaDominio(correoCompleto, sugerencia)}</span>? Toca para corregir
                </button>
            )}

            {correoCompleto && (
                <p className="text-xs text-subtle">
                    Quedará: <span className="font-medium text-body">{correoCompleto}</span>
                </p>
            )}
        </div>
    );
}

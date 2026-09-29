"use client";

import Link from "next/link";
import type { NavEntry } from "@/lib/nav/para-rol";
import { IconoNav, tieneIcono, InicioIcon } from "@/components/modules/nav/IconoNav";

/**
 * SPEC-744 · HojaMas — hoja inferior que abre la pestaña «Más» de la BarraInferior.
 *
 * Trae el RESTO del menú del rol (lo que no cupo en las ≤4 principales), CON los grupos
 * (como la lateral): un grupo se pinta como encabezado + sus hijos; las hojas, como ítem.
 * Nada del menú queda inalcanzable (FORMA §2 · candado). Fondo `.glass`, activo en cielo,
 * tokens del sistema. Cada enlace navega y cierra la hoja.
 */
export function HojaMas({
    resto,
    activo,
    onCerrar,
}: {
    resto: NavEntry[];
    activo: (href: string) => boolean;
    onCerrar: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 sm:hidden">
            {/* Velo: tocar afuera cierra. */}
            <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-tinta/40" />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Más"
                className="glass absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
                <h2 className="px-4 pb-2 pt-4 text-lg font-semibold text-body">Más</h2>
                <ul className="px-2 pb-2">
                    {resto.map((item) =>
                        item.children && item.children.length > 0 ? (
                            <li key={item.label}>
                                {/* Grupo: encabezado + hijos (como la lateral, pero sin colapsar en la hoja). */}
                                <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-subtle">{item.label}</p>
                                <ul>
                                    {item.children.map((hijo) => (
                                        <EnlaceMas key={hijo.href} item={hijo} active={activo(hijo.href)} onCerrar={onCerrar} conFallback={false} />
                                    ))}
                                </ul>
                            </li>
                        ) : (
                            <EnlaceMas key={item.href} item={item} active={activo(item.href)} onCerrar={onCerrar} conFallback />
                        ),
                    )}
                </ul>
            </div>
        </div>
    );
}

function EnlaceMas({
    item,
    active,
    onCerrar,
    conFallback,
}: {
    item: NavEntry;
    active: boolean;
    onCerrar: () => void;
    conFallback: boolean;
}) {
    // Hojas de primer nivel llevan ícono (con fallback); los hijos de grupo, sólo si tienen propio.
    const mostrarIcono = conFallback || tieneIcono(item.iconKey);
    return (
        <li>
            <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onCerrar}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active ? "bg-cielo text-acento-ink" : "text-body hover:bg-tinta/5"
                }`}
            >
                {/* `mostrarIcono` ya decide si va ícono; el fallback sólo aplica a hojas de primer nivel. */}
                {mostrarIcono && <IconoNav clave={item.iconKey} className="h-5 w-5" fallback={InicioIcon} />}
                {item.label}
            </Link>
        </li>
    );
}

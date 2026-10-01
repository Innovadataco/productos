"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navMovilParaRol, type NavEntry } from "@/lib/nav/para-rol";
import type { EstadoProfesionalSesion } from "@/lib/profesional/menu-por-estado";
import { IconoNav, InicioIcon } from "@/components/modules/nav/IconoNav";
import { HojaMas } from "@/components/modules/nav/HojaMas";
import type { RolLateral } from "@/components/modules/nav/NavLateral";

/**
 * SPEC-744 · BarraInferior — la navegación móvil ÚNICA de los 4 roles (`sm:hidden`).
 *
 * Reemplaza a `PadreNavMovil` (que desbordaba con scroll horizontal) y CIERRA la brecha
 * de los roles internos (que en móvil no tenían nav). Pestañas = DESTINOS fijos (≤4) + «Más»;
 * NUNCA scroll horizontal (Material/HIG). La partición sale de `navMovilParaRol` (fuente única,
 * gateada, por ÁREA con módulos); la barra pinta EXACTO esos `principales` (no recomputa).
 * «Más» abre `HojaMas` con el resto. Activo en cielo + barra-indicador arriba (no sólo color,
 * WCAG 1.4.1) + aria-current; safe-area inferior (notch).
 */
export function BarraInferior({
    rol,
    modulosPermitidos,
    profesionalInicial,
}: {
    rol: RolLateral;
    modulosPermitidos: string[];
    profesionalInicial?: EstadoProfesionalSesion;
}) {
    const pathname = usePathname();
    // SPEC-802: el `habilitado` del profesional lo resuelve el SERVIDOR (layout) y llega por prop,
    // no de `user?.profesional` del cliente (la carrera que afirmaría «portero» en el primer pintado).
    const { principales, resto } = navMovilParaRol(rol, { modulosPermitidos, profesional: profesionalInicial, pathname });
    const [masAbierto, setMasAbierto] = useState(false);

    const raiz = principales[0]?.href;
    const esActivo = (href: string) =>
        href !== "#" && (pathname === href || (href !== raiz && (pathname?.startsWith(href + "/") ?? false)));
    // «Más» se marca si la ruta actual cae en el resto (hoja suelta o hijo de grupo).
    const restoActivo = resto.some((i) => esActivo(i.href) || (i.children ?? []).some((h) => esActivo(h.href)));
    const hayMas = resto.length > 0;

    return (
        <>
            {masAbierto && <HojaMas resto={resto} activo={esActivo} onCerrar={() => setMasAbierto(false)} />}
            <nav
                aria-label="Navegación"
                className="fixed inset-x-0 bottom-0 z-40 flex border-t border-tinta/10 bg-papel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden dark:bg-papel/95"
            >
                {principales.map((item) => (
                    <TabDestino key={item.href} item={item} active={esActivo(item.href)} />
                ))}
                {hayMas && (
                    <button
                        type="button"
                        onClick={() => setMasAbierto(true)}
                        aria-haspopup="dialog"
                        aria-expanded={masAbierto}
                        className={`relative flex flex-1 flex-col items-center gap-1 px-1 py-2 text-center transition ${
                            restoActivo ? "font-semibold text-cielo-700" : "font-medium text-subtle hover:text-body"
                        }`}
                    >
                        {restoActivo && <span aria-hidden="true" className="absolute inset-x-0 top-0 mx-auto h-[2.5px] w-6 rounded-b bg-cielo" />}
                        <MasIcon className="h-5 w-5" />
                        <span className="text-[10px]">Más</span>
                    </button>
                )}
            </nav>
        </>
    );
}

function TabDestino({ item, active }: { item: NavEntry; active: boolean }) {
    return (
        <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 px-1 py-2 text-center transition ${
                active ? "font-semibold text-cielo-700" : "font-medium text-subtle hover:text-body"
            }`}
        >
            {active && <span aria-hidden="true" className="absolute inset-x-0 top-0 mx-auto h-[2.5px] w-6 rounded-b bg-cielo" />}
            <IconoNav clave={item.iconKey} className="h-5 w-5" fallback={InicioIcon} />
            <span className="text-[10px]">{item.labelCorto ?? item.label}</span>
        </Link>
    );
}

function MasIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h.01M12 12h.01M18 12h.01" />
        </svg>
    );
}

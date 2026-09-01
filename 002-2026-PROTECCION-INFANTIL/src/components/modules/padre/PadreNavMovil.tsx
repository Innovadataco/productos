"use client";

/**
 * SPEC-339 (A-67 §4) — Navegación del padre en móvil.
 *
 * Hasta hoy `PadreSideNav` era `hidden sm:flex`: en el teléfono el padre NO
 * tenía ningún menú — terminaba el camino y quedaba encerrado en la pantalla
 * donde cayera, el «callejón sin salida» que el brief prohíbe. Jelkin: «la
 * mayoría de los padres van a entrar desde el móvil».
 *
 * Barra inferior fija, visible SOLO bajo `sm` (el escritorio conserva la lista
 * lateral intacta). Los destinos salen de `PADRE_NAV_ITEMS` — la misma lista
 * única del lateral, cero listas paralelas. «Reportar» se queda (decisión CEO,
 * precedente I-38).
 *
 * Con más destinos de los que caben en 390 px, la barra desplaza horizontal
 * DENTRO de sí misma (scroll propio, sin desbordar la página).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PADRE_NAV_ITEMS } from "@/lib/nav-items";

export function PadreNavMovil() {
    const pathname = usePathname();
    const raiz = PADRE_NAV_ITEMS[0]?.href;
    const esActivo = (href: string) =>
        pathname === href || (href !== raiz && (pathname?.startsWith(href + "/") ?? false));

    return (
        <nav
            aria-label="Menú del padre"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-cielo/40 bg-papel/95 backdrop-blur-xl sm:hidden dark:border-cielo/30 dark:bg-tinta/95"
        >
            <ul className="flex overflow-x-auto px-1 py-1.5">
                {PADRE_NAV_ITEMS.map((item) => {
                    const activo = esActivo(item.href);
                    return (
                        <li key={item.href} className="min-w-fit flex-1">
                            <Link
                                href={item.href}
                                aria-current={activo ? "page" : undefined}
                                className={`block whitespace-nowrap rounded-xl px-3 py-2 text-center text-xs font-medium transition-colors ${
                                    activo
                                        ? "bg-pino/10 text-pino"
                                        : "text-muted hover:text-body"
                                }`}
                            >
                                {item.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

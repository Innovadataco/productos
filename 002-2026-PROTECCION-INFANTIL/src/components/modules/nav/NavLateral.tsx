"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { navParaRol, type NavEntry } from "@/lib/nav/para-rol";
import type { EstadoProfesionalSesion } from "@/lib/profesional/menu-por-estado";
import { IconoNav, tieneIcono, InboxIcon, InicioIcon, type IconoNavComponente } from "@/components/modules/nav/IconoNav";

/**
 * SPEC-744 · NavLateral — la barra lateral de escritorio ÚNICA de los 4 roles.
 *
 * Unifica PadreSideNav / ColegioSideNav / AdminNav en un solo componente: mismo patrón
 * (lista vertical, estado activo, grupos colapsables), distinto CONTENIDO. La lista sale
 * de `navParaRol(rol, {modulosPermitidos})` (fuente única, ya gateada) — cero listas a mano.
 * Se monta POR ÁREA desde el layout de cada rol, que le pasa `rol` + `modulosPermitidos`
 * (nada global-sin-módulos: sin módulos el resolver de internos/colegio devuelve vacío).
 *
 * Presentación por familia (color/título/pie): admin (cielo + ámbar en Pagos + pie
 * «Cambiar contraseña»), colegio (pino), padre (cielo). Íconos: `IconoNav` (fuente única,
 * SPEC-744). Movimiento del chevron sólo bajo `motion-safe`. Grupos: colegio/padre NACEN
 * EXPANDIDOS (FORMA §4); SPEC-857: los MÓDULOS del admin nacen COLAPSADOS salvo que la ruta
 * activa caiga dentro (abrir-en-activo). Dos ENCABEZADOS de sección (admin) son separadores no
 * navegables. Si la ruta activa cae en un grupo, su encabezado se marca.
 */
export type RolLateral =
    | "ADMIN"
    | "OPERADOR"
    | "COMITE_VALIDACION"
    | "PROFESIONAL"
    | "SCHOOL_ADMIN"
    | "COMITE_CONVIVENCIA"
    | "PARENT";

type Familia = "admin" | "colegio" | "padre";

interface TemaLateral {
    nav: string;
    borde: string;
    fallback: IconoNavComponente;
    footer: boolean;
    enlace: (active: boolean, esPagos: boolean) => string;
    grupo: (conActivo: boolean) => string;
}

const TEMAS: Record<Familia, TemaLateral> = {
    admin: {
        nav: "border-tinta/10 bg-papel/70 dark:bg-papel/60",
        borde: "border-tinta/10",
        fallback: InboxIcon,
        footer: true,
        enlace: (active, esPagos) =>
            active
                ? esPagos
                    ? "bg-ambar text-white shadow-lg shadow-ambar/25 dark:bg-ambar dark:shadow-ambar/20"
                    : "accent-gradient text-white shadow-lg shadow-cielo/25 dark:shadow-cielo/20"
                : esPagos
                    ? "text-ambar hover:bg-ambar/10 dark:text-ambar dark:hover:bg-ambar/20 hover:text-ambar"
                    : "text-muted hover:bg-tinta/5 hover:text-body",
        grupo: (conActivo) => (conActivo ? "text-body" : "text-muted hover:bg-tinta/5 hover:text-body"),
    },
    colegio: {
        nav: "border-pino/20 bg-pino/5",
        borde: "border-pino/20",
        fallback: InicioIcon,
        footer: false,
        enlace: (active) =>
            active ? "bg-pino text-white shadow-lg shadow-pino/25" : "text-muted hover:bg-pino/10 hover:text-pino",
        grupo: (conActivo) => (conActivo ? "text-pino" : "text-muted hover:bg-pino/10 hover:text-pino"),
    },
    padre: {
        nav: "border-cielo/20 bg-cielo/5",
        borde: "border-cielo/20",
        fallback: InicioIcon,
        footer: false,
        enlace: (active) =>
            active ? "bg-cielo text-acento-ink shadow-lg shadow-cielo/25" : "text-muted hover:bg-cielo/10 hover:text-cielo",
        grupo: (conActivo) => (conActivo ? "text-cielo" : "text-muted hover:bg-cielo/10 hover:text-cielo"),
    },
};

function familiaDeRol(rol: RolLateral): Familia {
    if (rol === "SCHOOL_ADMIN" || rol === "COMITE_CONVIVENCIA") return "colegio";
    if (rol === "PARENT") return "padre";
    return "admin";
}

function tituloDeRol(rol: RolLateral): { titulo: string; subtitulo: string } {
    switch (rol) {
        case "OPERADOR":
            return { titulo: "Operador", subtitulo: "Protección Infantil" };
        case "PROFESIONAL":
            return { titulo: "Profesional", subtitulo: "Protección Infantil" };
        case "SCHOOL_ADMIN":
        case "COMITE_CONVIVENCIA":
            return { titulo: "Mi colegio", subtitulo: "Panel institucional" };
        case "PARENT":
            return { titulo: "Mi protección", subtitulo: "Área del padre" };
        default:
            return { titulo: "Administración", subtitulo: "Protección Infantil" };
    }
}

export function NavLateral({
    rol,
    modulosPermitidos,
    profesionalInicial,
}: {
    rol: RolLateral;
    modulosPermitidos: string[];
    profesionalInicial?: EstadoProfesionalSesion;
}) {
    const pathname = usePathname();
    // SPEC-744: la nav sale de la fuente única (navParaRol), que aplica la compuerta de cada rol
    // (módulo ∧ proxy para internos/colegio; estado `habilitado` + muro de aceptación para el profesional).
    // SPEC-802: el `habilitado` del profesional lo resuelve el SERVIDOR (layout) y llega por prop
    // `profesionalInicial` — NO de `user?.profesional` del cliente, que arranca `undefined` y haría que el
    // SSR afirme «portero» antes de saber. Así el primer pintado ya es el correcto. El activo es presentación.
    const items = navParaRol(rol, { modulosPermitidos, profesional: profesionalInicial, pathname });
    const raiz = items[0]?.href;
    // SPEC-857: con hojas ANIDADAS en módulos, un href puede ser PREFIJO de su hermano (p.ej. «Bandeja»
    // /comite y «Gestión» /comite/gestion). Un `startsWith` marcaría a los dos. El activo es un solo
    // ganador: el href MÁS LARGO (el más específico) que sea el pathname o su prefijo. La raíz (items[0])
    // sólo activa por coincidencia EXACTA (no por prefijo), como antes.
    const hrefActivo = (() => {
        const candidatos: string[] = [];
        const juntar = (its: NavEntry[]) => {
            for (const it of its) {
                if (it.children && it.children.length > 0) juntar(it.children);
                else if (!it.esEncabezado) candidatos.push(it.href);
            }
        };
        juntar(items);
        return candidatos
            .filter((h) => h !== "#" && (pathname === h || (h !== raiz && (pathname?.startsWith(h + "/") ?? false))))
            .sort((a, b) => b.length - a.length)[0];
    })();
    const esActivo = (href: string) => href !== "#" && href === hrefActivo;

    const familia = familiaDeRol(rol);
    const tema = TEMAS[familia];
    const { titulo, subtitulo } = tituloDeRol(rol);
    // SPEC-479: el colegio pinta el subtítulo en `text-muted` (AA sobre el glow pino); el resto en `text-subtle`.
    const subtituloClase = familia === "colegio" ? "text-muted" : "text-subtle";

    return (
        <nav
            aria-label={`Menú de ${titulo}`}
            className={`hidden w-64 flex-shrink-0 flex-col border-r ${tema.nav} backdrop-blur-xl sm:flex`}
        >
            <div className={`border-b ${tema.borde} p-6`}>
                <h1 className="text-lg font-bold text-body">{titulo}</h1>
                <p className={`mt-1 text-xs ${subtituloClase}`}>{subtitulo}</p>
            </div>
            <ul className="flex-1 space-y-1 p-3">
                {items.map((item) =>
                    item.esEncabezado ? (
                        // SPEC-857: encabezado de sección NO navegable (separador del menú de 2 niveles).
                        <EncabezadoLateral key={`enc-${item.label}`} label={item.label} />
                    ) : item.children && item.children.length > 0 ? (
                        <GrupoLateral key={item.label} grupo={item} tema={tema} familia={familia} esActivo={esActivo} />
                    ) : (
                        <EnlaceLateral key={item.href} item={item} tema={tema} active={esActivo(item.href)} />
                    ),
                )}
            </ul>
            {tema.footer && (
                <div className={`border-t ${tema.borde} p-3`}>
                    <Link
                        href="/cambiar-password"
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted transition hover:bg-tinta/5 hover:text-body"
                    >
                        <KeyIcon className="h-4 w-4" />
                        Cambiar contraseña
                    </Link>
                </div>
            )}
        </nav>
    );
}

/** SPEC-857: encabezado de sección NO navegable (separador del menú admin de 2 niveles). Rótulo
 *  tenue, sin enlace ni botón. Sólo aparece en la familia admin (las otras no tienen secciones). */
function EncabezadoLateral({ label }: { label: string }) {
    return (
        <li className="select-none px-4 pb-1 pt-5 text-[0.7rem] font-semibold uppercase tracking-wide text-subtle first:pt-2">
            {label}
        </li>
    );
}

function EnlaceLateral({ item, tema, active }: { item: NavEntry; tema: TemaLateral; active: boolean }) {
    // SPEC-212: la entrada de Pagos va en ámbar (acción de dinero), no en el acento del rol. SPEC-857:
    // Pagos pasó a MÓDULO; el ámbar de sus hijos lo aplica GrupoLateral. Acá queda por si una hoja
    // suelta de pagos volviera al top-level (startsWith cubre /pagos y /pagos/*).
    const esPagos = item.href.startsWith("/dashboard/admin/pagos");
    return (
        <li>
            <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${tema.enlace(active, esPagos)}`}
            >
                <IconoNav clave={item.iconKey} className="h-4 w-4" fallback={tema.fallback} />
                {item.label}
            </Link>
        </li>
    );
}

/**
 * Grupo colapsable (admin: módulos SPEC-857; padre «Reportar»/«Ayuda profesional»; colegio «Usuarios»).
 * SPEC-744: en colegio/padre NACE EXPANDIDO (FORMA §4). SPEC-857: en la familia ADMIN nace COLAPSADO
 * salvo que la ruta activa caiga dentro (abrir-en-activo) — con ~9 módulos, abrir todo saturaría la barra.
 */
function GrupoLateral({
    grupo,
    tema,
    familia,
    esActivo,
}: {
    grupo: NavEntry;
    tema: TemaLateral;
    familia: Familia;
    esActivo: (href: string) => boolean;
}) {
    const panelId = useId();
    const hijos = grupo.children ?? [];
    const conActivo = hijos.some((h) => esActivo(h.href));
    // SPEC-857: estado inicial POR FAMILIA. Admin: colapsado salvo activo dentro. Resto: expandido.
    const [colapsado, setColapsado] = useState(familia === "admin" && !conActivo);
    const expandido = !colapsado;
    // SPEC-212/857: el módulo «Pagos» va en ámbar (acción de dinero): encabezado e hijos.
    const esGrupoPagos = hijos.some((h) => h.href.startsWith("/dashboard/admin/pagos/"));
    const claseBoton = esGrupoPagos
        ? conActivo
            ? "text-ambar"
            : "text-ambar hover:bg-ambar/10 hover:text-ambar"
        : tema.grupo(conActivo);

    return (
        <li>
            <button
                type="button"
                aria-expanded={expandido}
                aria-controls={panelId}
                onClick={() => setColapsado((c) => !c)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${claseBoton}`}
            >
                <IconoNav clave={grupo.iconKey} className="h-4 w-4" fallback={tema.fallback} />
                <span className="flex-1 text-left">{grupo.label}</span>
                <ChevronIcon className={`h-3.5 w-3.5 motion-safe:transition-transform ${expandido ? "rotate-180" : ""}`} />
            </button>
            {expandido && (
                <ul id={panelId} className={`ml-5 space-y-1 border-l ${tema.borde} pl-3`}>
                    {hijos.map((hijo) => {
                        const active = esActivo(hijo.href);
                        const esPagosHijo = hijo.href.startsWith("/dashboard/admin/pagos/");
                        return (
                            <li key={hijo.href}>
                                <Link
                                    href={hijo.href}
                                    aria-current={active ? "page" : undefined}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${tema.enlace(active, esPagosHijo)}`}
                                >
                                    {tieneIcono(hijo.iconKey) && <IconoNav clave={hijo.iconKey} className="h-4 w-4" />}
                                    {hijo.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
    );
}

function KeyIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
    );
}

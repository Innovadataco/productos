"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { Guardian } from "@/components/ui/Guardian";

/**
 * Destino del logo por rol y ubicación (extraído para test de regresión, O-1 de 002-PI-051).
 * Zona autenticada (/dashboard/**): al panel del rol. Zona pública: "/" para todos
 * (SPEC-106: un ADMIN debe poder navegar la app pública sin que el header lo secuestre)
 * EXCEPTO SCHOOL_ADMIN (D-a de 002-PI-051): la cuenta institucional no reporta
 * (proxy.ts), así que su logo SIEMPRE va a su panel, también en zona pública.
 */
// SPEC-319: esto NO es la fuente única rol→home (esa vive en src/lib/auth/home-para-rol.ts).
// Es el destino del click en el LOGO — contextual (público vs autenticado) y ya maneja
// COMITE_CONVIVENCIA. No unificar con la fuente única de landing: son propósitos distintos.
export function destinoLogo(user: { rol: string } | null, pathname: string | null): string {
    const enAreaAutenticada = pathname?.startsWith("/dashboard") ?? false;
    if (user?.rol === "SCHOOL_ADMIN") return "/dashboard/colegio";
    // SPEC-168: el comité de convivencia siempre va a su bandeja (su única área).
    if (user?.rol === "COMITE_CONVIVENCIA") return "/dashboard/colegio/comite/casos";
    if (!user || !enAreaAutenticada) return "/";
    // SPEC-404 (I-290): el logo aterriza en la bandeja; el raíz `/dashboard/admin`
    // se reservó como aterrizaje que respeta marcadores viejos y no como destino click.
    if (user.rol === "ADMIN" || user.rol === "OPERADOR") return "/dashboard/admin/bandeja";
    if (user.rol === "COMITE_VALIDACION") return "/dashboard/admin/comite";
    return "/dashboard";
}

/**
 * SPEC-362 (A-70 · G16): entrada del menú apagada durante el camino. Se ve,
 * dice por qué no responde y no navega a ninguna parte.
 */
function ItemApagado({ children }: { children: React.ReactNode }) {
    return (
        <span
            data-testid="nav-item-apagado"
            aria-disabled="true"
            title="Disponible al terminar de configurar tu cuenta"
            className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm font-medium text-muted/60"
        >
            {children}
        </span>
    );
}

export function NavHeader() {
    const { user, isLoading, logout } = useAuth();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    // SPEC-340 (A-68 §5): el ámbar del escudo — SOLO para el padre, mientras
    // tenga alertas sin ver (del círculo o de sus hijos). Se consulta al montar
    // y al recuperar el foco; sin polling agresivo.
    const [alertasSinVer, setAlertasSinVer] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user?.rol !== "PARENT") {
            setAlertasSinVer(0);
            return;
        }
        const consultar = () =>
            fetch("/api/notificaciones/resumen", { credentials: "include" })
                .then((r) => (r.ok ? r.json() : null))
                .then((j) => setAlertasSinVer(j?.noLeidas ?? 0))
                .catch(() => null);
        void consultar();
        const alFoco = () => void consultar();
        window.addEventListener("focus", alFoco);
        return () => window.removeEventListener("focus", alFoco);
    }, [user?.rol, pathname]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const initials = user
        ? (user.nombre?.[0] || user.email[0]).toUpperCase()
        : "";

    // SPEC-319 §2.6 + SPEC-424 (I-299): "empleado" es el flag histórico que
    // controla si el usuario ve items del padre en el menú. VERIFICADOR y
    // PROFESIONAL entran acá porque tampoco son "el padre" — el primero es
    // interno, el segundo es prestador externo — y sin este check, ambos
    // heredaban "Mi panel"/"Círculo de Confianza"/"Mis reportes" del padre.
    const esEmpleado =
        user?.rol === "ADMIN" ||
        user?.rol === "OPERADOR" ||
        user?.rol === "COMITE_VALIDACION" ||
        user?.rol === "COMITE_CONVIVENCIA" ||
        user?.rol === "VERIFICADOR" ||
        user?.rol === "PROFESIONAL";

    const headerBorderClass = user?.rol === "ADMIN"
        ? "border-b-amber-500/40 dark:border-b-amber-400/30"
        : user?.rol === "OPERADOR"
            ? "border-b-violet-500/40 dark:border-b-violet-400/30"
            : user?.rol === "COMITE_VALIDACION"
                ? "border-b-emerald-500/40 dark:border-b-emerald-400/30"
                : "border-b-white/40 dark:border-b-white/10";

    const avatarClass = user?.rol === "ADMIN"
        ? "bg-amber-500"
        : user?.rol === "OPERADOR"
            ? "bg-violet-500"
            : user?.rol === "COMITE_VALIDACION"
                ? "bg-emerald-500"
                : "accent-gradient";

    const rolBadgeClass = user?.rol === "ADMIN"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : user?.rol === "OPERADOR"
            ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
            : user?.rol === "COMITE_VALIDACION"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

    const dashboardHref = user?.rol === "SCHOOL_ADMIN"
        ? "/dashboard/colegio"
        : user?.rol === "COMITE_CONVIVENCIA"
            ? "/dashboard/colegio/comite/casos"
            : user?.rol === "PARENT"
                ? "/dashboard/padre" // SPEC-317: zona canónica del padre
                // SPEC-424 (I-299) + SPEC-425 (A-75 L5): el «Dashboard» del
                // profesional aterriza en el panel del rol, ya vivo en main.
                : user?.rol === "PROFESIONAL"
                    ? "/dashboard/profesional"
                    : "/dashboard-publico";

    // El logo lleva al panel del rol SOLO dentro del área autenticada (/dashboard/**).
    // En rutas públicas va al home público aunque haya sesión (SPEC-106), EXCEPTO
    // SCHOOL_ADMIN, cuyo logo siempre va a su panel (D-a de 002-PI-051).
    const logoDestino = destinoLogo(user, pathname ?? null);
    // I-38 (SPEC-114): el logo NUNCA es un clic muerto — si el destino es la página actual,
    // va al home público (destino vivo para todos los roles desde SPEC-118/D-37).
    const logoHref = logoDestino === pathname ? "/" : logoDestino;

    // D-37 (SPEC-118): ningún elemento de navegación ofrece un destino que el proxy
    // vaya a bloquear ni la página actual — una sola regla para TODOS los roles y
    // todos los enlaces del header (botón Dashboard, menú de usuario, menú móvil).
    // La única excepción es el logo en "/" (la marca siempre se muestra; apuntar al
    // inicio estando en el inicio es convención universal y no hay destino alternativo).
    /**
     * SPEC-362 (A-70 · G16): durante el camino guiado el menú superior se apaga.
     *
     * Hasta hoy ofrecía "Mi panel", "Círculo" y "Mis reportes" mientras el
     * usuario estaba a mitad del camino: el guardián lo devolvía al paso (o la
     * pantalla fallaba), así que eran botones que prometían y no cumplían.
     * Se pintan en gris, sin acción. Cambiar contraseña y cerrar sesión siguen
     * vivos: son las dos salidas que nadie puede perder.
     */
    const enCamino = pathname?.startsWith("/camino") ?? false;
    const SIEMPRE_VIVAS = ["/cambiar-password"];

    const esEnlaceNavegable = (href: string) =>
        href !== pathname &&
        esDestinoPermitidoPorRol(user?.rol, href) &&
        (!enCamino || SIEMPRE_VIVAS.includes(href));


    return (
        <header className={`fixed top-0 left-0 right-0 z-50 glass ${headerBorderClass}`}>
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                <Link href={logoHref} className="flex items-center gap-2 text-lg font-bold tracking-tight text-body">
                    {/* SPEC-336: El Guardián. SPEC-340 (§5): ámbar con alertas sin ver. */}
                    <Guardian className="h-8 w-8" estado={alertasSinVer > 0 ? "alerta" : "calma"} />
                    <span className="text-gradient">Protección</span>
                    <span className="hidden sm:inline">Infantil</span>
                </Link>

                <nav className="flex items-center gap-2 sm:gap-3">
                    <ThemeToggle />

                    {esEnlaceNavegable(dashboardHref) && (
                        <Link
                            href={dashboardHref}
                            className="hidden sm:inline-flex rounded-xl glass-input px-4 py-2 text-sm font-semibold text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                        >
                            Dashboard
                        </Link>
                    )}

                    {isLoading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                    ) : user ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setOpen((v) => !v)}
                                className="flex min-h-[44px] items-center gap-2 rounded-xl glass-input px-2.5 py-2 text-sm font-medium text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                                aria-expanded={open}
                                aria-haspopup="true"
                                aria-label="Menú de usuario"
                            >
                                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClass}`}>
                                    {initials}
                                </span>
                                <span className="hidden sm:inline max-w-[10rem] truncate">{user.nombre || user.email}</span>
                                <ChevronIcon className={`h-4 w-4 text-subtle transition ${open ? "rotate-180" : ""}`} />
                            </button>

                            {open && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl">
                                    <div className="border-b border-slate-100 dark:border-slate-800 px-3 py-2">
                                        <p className="text-sm font-semibold text-body truncate">{user.nombre || user.email}</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${rolBadgeClass}`}>
                                                {user.rol.toLowerCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="py-1">
                                        {user.rol === "ADMIN" && (
                                            <>
                                                {esEnlaceNavegable("/dashboard/admin") && (
                                                    <NavDropdownLink href="/dashboard/admin" onClick={() => setOpen(false)}>
                                                        Panel de administración
                                                    </NavDropdownLink>
                                                )}
                                                {esEnlaceNavegable("/dashboard/admin/configuracion") && (
                                                    <NavDropdownLink href="/dashboard/admin/configuracion" onClick={() => setOpen(false)}>
                                                        Configuración
                                                    </NavDropdownLink>
                                                )}
                                            </>
                                        )}
                                        {user.rol === "SCHOOL_ADMIN" && esEnlaceNavegable("/dashboard/colegio") && (
                                            <NavDropdownLink href="/dashboard/colegio" onClick={() => setOpen(false)}>
                                                Mi colegio
                                            </NavDropdownLink>
                                        )}
                                        {user.rol === "OPERADOR" && esEnlaceNavegable("/dashboard/admin") && (
                                            <NavDropdownLink href="/dashboard/admin" onClick={() => setOpen(false)}>
                                                Mis casos
                                            </NavDropdownLink>
                                        )}
                                        {user.rol === "COMITE_VALIDACION" && esEnlaceNavegable("/dashboard/admin/comite") && (
                                            <NavDropdownLink href="/dashboard/admin/comite" onClick={() => setOpen(false)}>
                                                Mi bandeja
                                            </NavDropdownLink>
                                        )}
                                        {user.rol === "COMITE_CONVIVENCIA" && esEnlaceNavegable("/dashboard/colegio/comite/casos") && (
                                            <NavDropdownLink href="/dashboard/colegio/comite/casos" onClick={() => setOpen(false)}>
                                                {/* SPEC-319 §2.5: un destino, un nombre — "Gestión de casos" (igual que el lateral) */}
                                                Gestión de casos
                                            </NavDropdownLink>
                                        )}
                                        {/* SPEC-424 (I-299): items del profesional. Hasta SPEC-425
                                            (Dev 02 · panel L5), la entrada principal es la
                                            verificación — lo único que hoy tiene su propia pantalla. */}
                                        {user.rol === "PROFESIONAL" && (
                                            <>
                                                {esEnlaceNavegable("/perfil-profesional/verificacion") && (
                                                    <NavDropdownLink href="/perfil-profesional/verificacion" onClick={() => setOpen(false)}>
                                                        Verificación
                                                    </NavDropdownLink>
                                                )}
                                                {esEnlaceNavegable("/perfil-profesional/completar") && (
                                                    <NavDropdownLink href="/perfil-profesional/completar" onClick={() => setOpen(false)}>
                                                        Mi ficha
                                                    </NavDropdownLink>
                                                )}
                                            </>
                                        )}
                                        {!esEmpleado && (
                                            <>
                                                {enCamino ? (
                                                    // SPEC-362 (G16): en gris mientras el camino no termina.
                                                    <>
                                                        <ItemApagado>Mi panel</ItemApagado>
                                                        <ItemApagado>Círculo de Confianza</ItemApagado>
                                                        <ItemApagado>Mis reportes</ItemApagado>
                                                    </>
                                                ) : (
                                                    <>
                                                        {esEnlaceNavegable("/dashboard/padre") && (
                                                            <NavDropdownLink href="/dashboard/padre" onClick={() => setOpen(false)}>
                                                                Mi panel
                                                            </NavDropdownLink>
                                                        )}
                                                        {esEnlaceNavegable("/dashboard/padre/circulo-confianza") && (
                                                            <NavDropdownLink href="/dashboard/padre/circulo-confianza" onClick={() => setOpen(false)}>
                                                                Círculo de Confianza
                                                            </NavDropdownLink>
                                                        )}
                                                        {esEnlaceNavegable("/mis-reportes") && (
                                                            <NavDropdownLink href="/mis-reportes" onClick={() => setOpen(false)}>
                                                                Mis reportes
                                                            </NavDropdownLink>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}
                                        <hr className="my-1 border-slate-100 dark:border-slate-800" />
                                        {/* I-33 (SPEC-108): /cambiar-password estaba huérfana — entrada visible para TODOS los roles */}
                                        {esEnlaceNavegable("/cambiar-password") && (
                                            <NavDropdownLink href="/cambiar-password" onClick={() => setOpen(false)}>
                                                Cambiar contraseña
                                            </NavDropdownLink>
                                        )}
                                        <button
                                            onClick={async () => {
                                                setOpen(false);
                                                await logout();
                                                window.location.href = "/";
                                            }}
                                            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                                        >
                                            Cerrar sesión
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        esEnlaceNavegable("/login") && (
                            <Link
                                href="/login"
                                className="rounded-xl glass-input px-4 py-2 text-sm font-semibold text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                            >
                                Iniciar sesión
                            </Link>
                        )
                    )}

                    <Tooltip content="Menú">
                        <button
                            className="sm:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl glass-input text-body"
                            onClick={() => setMobileOpen((v) => !v)}
                            aria-label="Menú"
                        >
                            {mobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                        </button>
                    </Tooltip>
                </nav>
            </div>

            {mobileOpen && (
                <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-lg">
                    <div className="flex flex-col gap-2">
                        {esEnlaceNavegable("/") && <MobileLink href="/" onClick={() => setMobileOpen(false)}>Inicio</MobileLink>}
                        {esEnlaceNavegable("/dashboard-publico") && <MobileLink href="/dashboard-publico" onClick={() => setMobileOpen(false)}>Dashboard</MobileLink>}
                        {user ? (
                            <>
                                {!esEmpleado && (
                                    <>
                                        {esEnlaceNavegable("/dashboard/padre") && <MobileLink href="/dashboard/padre" onClick={() => setMobileOpen(false)}>Mi panel</MobileLink>}
                                        {esEnlaceNavegable("/dashboard/padre/circulo-confianza") && <MobileLink href="/dashboard/padre/circulo-confianza" onClick={() => setMobileOpen(false)}>Círculo de Confianza</MobileLink>}
                                        {esEnlaceNavegable("/mis-reportes") && <MobileLink href="/mis-reportes" onClick={() => setMobileOpen(false)}>Mis reportes</MobileLink>}
                                    </>
                                )}
                                {user.rol === "ADMIN" && (
                                    <>
                                        {esEnlaceNavegable("/dashboard/admin") && <MobileLink href="/dashboard/admin" onClick={() => setMobileOpen(false)}>Panel admin</MobileLink>}
                                        {esEnlaceNavegable("/dashboard/admin/configuracion") && <MobileLink href="/dashboard/admin/configuracion" onClick={() => setMobileOpen(false)}>Configuración</MobileLink>}
                                    </>
                                )}
                                {user.rol === "SCHOOL_ADMIN" && esEnlaceNavegable("/dashboard/colegio") && (
                                    <MobileLink href="/dashboard/colegio" onClick={() => setMobileOpen(false)}>Mi colegio</MobileLink>
                                )}
                                {user.rol === "OPERADOR" && esEnlaceNavegable("/dashboard/admin") && (
                                    <MobileLink href="/dashboard/admin" onClick={() => setMobileOpen(false)}>Mis casos</MobileLink>
                                )}
                                {user.rol === "COMITE_VALIDACION" && esEnlaceNavegable("/dashboard/admin/comite") && (
                                    <MobileLink href="/dashboard/admin/comite" onClick={() => setMobileOpen(false)}>Mi bandeja</MobileLink>
                                )}
                                {user.rol === "COMITE_CONVIVENCIA" && esEnlaceNavegable("/dashboard/colegio/comite/casos") && (
                                    <MobileLink href="/dashboard/colegio/comite/casos" onClick={() => setMobileOpen(false)}>Gestión de casos</MobileLink>
                                )}
                                {/* SPEC-424 (I-299): items del profesional. */}
                                {user.rol === "PROFESIONAL" && (
                                    <>
                                        {esEnlaceNavegable("/perfil-profesional/verificacion") && (
                                            <MobileLink href="/perfil-profesional/verificacion" onClick={() => setMobileOpen(false)}>Verificación</MobileLink>
                                        )}
                                        {esEnlaceNavegable("/perfil-profesional/completar") && (
                                            <MobileLink href="/perfil-profesional/completar" onClick={() => setMobileOpen(false)}>Mi ficha</MobileLink>
                                        )}
                                    </>
                                )}
                                <button
                                    onClick={async () => {
                                        setMobileOpen(false);
                                        await logout();
                                        window.location.href = "/";
                                    }}
                                    className="text-left text-sm font-medium text-red-600 dark:text-red-400 px-3 py-2"
                                >
                                    Cerrar sesión
                                </button>
                            </>
                        ) : (
                            esEnlaceNavegable("/login") && <MobileLink href="/login" onClick={() => setMobileOpen(false)}>Iniciar sesión</MobileLink>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

function NavDropdownLink({
    href,
    onClick,
    children,
}: {
    href: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="block rounded-lg px-3 py-2 text-sm text-body hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:text-accent transition"
        >
            {children}
        </Link>
    );
}

function MobileLink({
    href,
    onClick,
    children,
}: {
    href: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-body hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        >
            {children}
        </Link>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}

function MenuIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}

function XIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

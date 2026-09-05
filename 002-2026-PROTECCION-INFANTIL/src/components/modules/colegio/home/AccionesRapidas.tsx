import Link from "next/link";
import { CirclePlus, Upload, GraduationCap, Users } from "lucide-react";

/**
 * SPEC-143 (US4, FR-009) — Acciones rápidas: cada pantalla termina en un verbo.
 * Todas apuntan a rutas EXISTENTES. SPEC-148: "Profesores" ya apunta a su
 * pantalla propia (antes placeholder a cursos).
 * Terminología §3: "subir lista" (nunca "carga masiva"), verbos activos.
 * Tap targets ≥ 48px; íconos Lucide strokeWidth 1.5, tamaño 24 (§4.4).
 */

const ACCIONES = [
    {
        href: "/dashboard/colegio/cursos/unificado",
        titulo: "Crear curso y estudiantes",
        detalle: "Un curso nuevo con su lista",
        Icono: CirclePlus,
    },
    {
        href: "/dashboard/colegio/cursos/unificado?modo=excel",
        titulo: "Subir lista en Excel",
        detalle: "Creamos los cursos por ti",
        Icono: Upload,
    },
    {
        // SPEC-148: pantalla propia de profesores (reemplaza el placeholder a cursos).
        href: "/dashboard/colegio/profesores",
        titulo: "Profesores",
        detalle: "Agregue y organice el directorio",
        Icono: GraduationCap,
    },
    {
        href: "/dashboard/colegio/cursos",
        titulo: "Ver estudiantes",
        detalle: "Entra a cada curso",
        Icono: Users,
    },
] as const;

interface AccionesRapidasProps {
    className?: string;
}

export function AccionesRapidas({ className = "" }: AccionesRapidasProps) {
    return (
        <section aria-label="Acciones" className={className}>
            <h2 className="microetiqueta">Acciones</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ACCIONES.map(({ href, titulo, detalle, Icono }) => (
                    <Link
                        key={titulo}
                        href={href}
                        className="glass group flex min-h-12 items-center gap-3 rounded-[var(--radio-card)] p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tinta/5 text-accent transition group-hover:bg-tinta/10">
                            <Icono size={24} strokeWidth={1.5} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-body">{titulo}</span>
                            <span className="block text-xs text-subtle">{detalle}</span>
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}

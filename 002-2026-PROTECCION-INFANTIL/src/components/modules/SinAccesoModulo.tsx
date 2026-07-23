import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * Pantalla estándar cuando el rol no tiene permiso para el módulo de la página (spec 086).
 */
export function SinAccesoModulo({ volver = "/dashboard/admin" }: { volver?: string }) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <GlassCard className="max-w-md p-8 text-center">
                <h1 className="text-xl font-bold text-body">Sin acceso a este módulo</h1>
                <p className="mt-3 text-sm text-muted">
                    Tu rol no tiene permiso para acceder a esta sección. Si crees que deberías verla, contacta al administrador de la plataforma.
                </p>
                <Link
                    href={volver}
                    className="mt-6 inline-block rounded-xl accent-gradient px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition"
                >
                    Volver
                </Link>
            </GlassCard>
        </div>
    );
}

/**
 * Pantalla cuando el rol no tiene ningún módulo asignado (aterrizaje, spec 086).
 */
export function SinModulosAsignados() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <GlassCard className="max-w-md p-8 text-center">
                <h1 className="text-xl font-bold text-body">Sin módulos asignados</h1>
                <p className="mt-3 text-sm text-muted">
                    Tu cuenta no tiene ningún módulo habilitado. Contacta al administrador de la plataforma para que te asigne acceso.
                </p>
            </GlassCard>
        </div>
    );
}

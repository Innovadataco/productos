import { GlassCard } from "@/components/ui/GlassCard";

/**
 * Placeholder estándar para las rutas base del área del padre (SPEC-231).
 * Muestra el nombre de la sección y un mensaje "Próximamente" en una card vidrio.
 */
export function PlaceholderPadre({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <GlassCard className="w-full max-w-md p-8 text-center">
                <h1 className="text-2xl font-bold text-body">{titulo}</h1>
                <p className="mt-4 text-muted">{descripcion ?? "Esta sección estará disponible próximamente."}</p>
            </GlassCard>
        </div>
    );
}

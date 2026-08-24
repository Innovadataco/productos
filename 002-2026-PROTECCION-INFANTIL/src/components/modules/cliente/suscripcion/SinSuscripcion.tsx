import { GlassCard } from "@/components/ui/GlassCard";

/**
 * SPEC-211 (002-PI-111): estado vacío cuando el titular aún no tiene
 * suscripción registrada (el admin la crea al activar el servicio).
 */
export function SinSuscripcion() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <GlassCard className="w-full max-w-md p-8 text-center">
                <h1 className="text-2xl font-bold text-body">Mi suscripción</h1>
                <p className="mt-4 text-muted">
                    Aún no tienes una suscripción registrada. Cuando el equipo active tu servicio, aquí verás su
                    estado, tus pagos y tus beneficios.
                </p>
            </GlassCard>
        </div>
    );
}

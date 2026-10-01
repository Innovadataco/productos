import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { homeParaRol } from "@/lib/auth/home-para-rol";
import { citasPendientesEncuesta } from "@/lib/dal/services/encuesta-cita";
import { origenParaRol } from "@/lib/profesional/cita/encuesta-pendiente";
import { EncuestaFormulario } from "@/components/modules/encuesta/EncuestaFormulario";
import { formatoFechaLargaBogota } from "@/lib/fechas/formato-bogota";

// Depende de la sesión y de las citas del usuario: nunca se pre-renderiza estática.
export const dynamic = "force-dynamic";

/**
 * SPEC-784 · `/encuesta` — el destino de la TARJETA (padre) y del BLOQUE (profesional). No es una
 * compuerta: se llega desde el punto de entrada, nunca por redirect al entrar (FORMA punto-de-entrada).
 * Deriva las citas pendientes del usuario (fuente única) y monta el formulario de la elegida (la del
 * `?solicitud=` si sigue pendiente, o la más reciente). Sin pendientes → a su home.
 */
export default async function EncuestaPage({
    searchParams,
}: {
    searchParams: Promise<{ solicitud?: string }>;
}) {
    const user = await verifyAuth();
    const origen = origenParaRol(user.rol);
    if (!origen) redirect(homeParaRol(user.rol));

    const pendientes = await citasPendientesEncuesta(user.id, user.rol, new Date());
    if (pendientes.length === 0) redirect(homeParaRol(user.rol));

    const { solicitud } = await searchParams;
    const elegida = pendientes.find((p) => p.solicitudId === solicitud) ?? pendientes[0]!;

    return (
        <EncuestaFormulario
            solicitudId={elegida.solicitudId}
            origen={origen}
            fecha={formatoFechaLargaBogota(elegida.franjaInicio)}
        />
    );
}

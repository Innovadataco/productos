import { redirect } from "next/navigation";

interface PageProps {
    searchParams: Promise<{ bienvenida?: string }>;
}

/**
 * SPEC-607: la suscripción del padre vive dentro de «Mi perfil» (acordeón
 * «Suscripción»). Esta ruta queda como redirect de servidor con ancla para no
 * romper los enlaces existentes (guardián de vigencia, EsperandoAutorizacion,
 * home-sugerencia, correos). `?bienvenida=1` se conserva: lo usa
 * `SuscripcionVista` para el saludo post-autorización.
 */
export default async function PadreSuscripcionRedirectPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const bienvenida = params.bienvenida === "1" ? "?bienvenida=1" : "";
    redirect(`/dashboard/padre/perfil${bienvenida}#suscripcion`);
}

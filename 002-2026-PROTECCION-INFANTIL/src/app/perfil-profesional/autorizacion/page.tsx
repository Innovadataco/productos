/**
 * SPEC-686 (I-420) · Página de ACEPTACIÓN de la autorización del profesional.
 *
 * Server Component: carga el texto legal versionado + la versión vigente y decide.
 *  · Ya aceptó la versión vigente y NO viene a releer → vuelve a su área (nada que hacer).
 *  · `?releer=1` con la versión ya aceptada → SOLO LECTURA (derecho a releer, legal §8).
 *  · No aceptó la versión vigente → pantalla de aceptación (con aviso de re-aceptación si ya
 *    había aceptado una versión anterior — cambio DE FONDO, o «Leer y aceptar» de un MENOR).
 * El registro y el enlace «Leer la autorización» en reposo viven en Mi perfil (forma hermana).
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";
import { AceptacionAutorizacion } from "@/components/modules/profesional/AceptacionAutorizacion";

export const dynamic = "force-dynamic";

// SPEC-703/706: a dónde vuelve el profesional tras aceptar. El HABILITADO va a «Mi perfil». El que
// aún no está habilitado (BORRADOR, VENCIDO, etc.) vuelve a la FICHA — la ÚNICA pantalla del no
// habilitado (SPEC-706 retiró «Mi estado»), donde ve su estado arriba y decide enviar a revisión.
const DESTINO_HABILITADO = "/dashboard/profesional/mi-perfil";
const DESTINO_FICHA = "/perfil-profesional/completar";

export default async function AutorizacionProfesionalPage({
    searchParams,
}: {
    searchParams: Promise<{ releer?: string }>;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    const userId = payload?.sub as string | undefined;
    if (!userId) redirect("/login");

    const { releer } = await searchParams;
    const servicio = new AutorizacionProfesionalService();
    const [version, ultima, hab] = await Promise.all([
        servicio.versionVigente(),
        servicio.aceptacionVigente(userId),
        obtenerHabilitacionProfesional(userId),
    ]);
    const yaAceptoVigente = ultima?.version === version;
    const destino = hab?.habilitado ? DESTINO_HABILITADO : DESTINO_FICHA;

    // Ya aceptó la versión vigente y no viene a releer: no hay nada que aceptar acá.
    if (yaAceptoVigente && !releer) redirect(destino);

    const documentoContenido = await servicio.obtenerDocumentoVigente();

    return (
        <AceptacionAutorizacion
            version={version}
            documentoContenido={documentoContenido}
            redirectUrl={destino}
            {...(yaAceptoVigente ? { soloLectura: true } : {})}
            {...(!yaAceptoVigente && ultima ? { avisoReAceptacion: true } : {})}
        />
    );
}

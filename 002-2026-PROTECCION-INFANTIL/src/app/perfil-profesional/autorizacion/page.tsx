/**
 * SPEC-686 (I-420) · Página de ACEPTACIÓN de la autorización del profesional.
 *
 * Server Component: carga el texto legal versionado + la versión vigente y decide.
 *  · Si el profesional aún no aceptó la versión vigente → muestra la pantalla de aceptación
 *    (con aviso de re-aceptación si ya había aceptado una versión anterior — cambio DE FONDO).
 *  · Si ya la aceptó → no tiene nada que hacer acá; vuelve a su área.
 * El registro y el «Leer la autorización» en reposo viven en Mi perfil (forma hermana).
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";
import { AceptacionAutorizacion } from "@/components/modules/profesional/AceptacionAutorizacion";

export const dynamic = "force-dynamic";

const DESTINO_PROFESIONAL = "/perfil-profesional/completar";

export default async function AutorizacionProfesionalPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    const userId = payload?.sub as string | undefined;
    if (!userId) redirect("/login");

    const servicio = new AutorizacionProfesionalService();
    const [version, ultima] = await Promise.all([
        servicio.versionVigente(),
        servicio.aceptacionVigente(userId),
    ]);

    // Ya aceptó la versión vigente: no hay nada que aceptar acá.
    if (ultima?.version === version) redirect(DESTINO_PROFESIONAL);

    const documentoContenido = await servicio.obtenerDocumentoVigente();

    return (
        <AceptacionAutorizacion
            version={version}
            documentoContenido={documentoContenido}
            redirectUrl={DESTINO_PROFESIONAL}
            // Ya había aceptado ANTES otra versión → es una re-aceptación (cambio DE FONDO).
            {...(ultima ? { avisoReAceptacion: true } : {})}
        />
    );
}

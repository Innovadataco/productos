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
import { AutorizacionPasoFinal } from "@/components/modules/profesional/AutorizacionPasoFinal";

export const dynamic = "force-dynamic";

// SPEC-703/706: a dónde vuelve el HABILITADO tras (re)aceptar. El no habilitado está en el
// asistente de registro (SPEC-740): su paso 3 es `AutorizacionPasoFinal`, que envía a revisión.
const DESTINO_HABILITADO = "/dashboard/profesional/mi-perfil";

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
    const documentoContenido = await servicio.obtenerDocumentoVigente();

    // SPEC-740: el NO habilitado está en el REGISTRO — la autorización es el PASO 3 (terminal)
    // del asistente: aceptar desbloquea «enviar a revisión». No se rebota aunque ya haya
    // aceptado (ahí ofrece el envío). El marco «Paso 3 de 3» lo pone el shell del layout.
    if (!hab?.habilitado) {
        return (
            <AutorizacionPasoFinal
                version={version}
                documentoContenido={documentoContenido}
                yaAcepto={yaAceptoVigente}
            />
        );
    }

    // Habilitado: re-aceptación por versión nueva (SPEC-686) o releer en solo lectura. NO es
    // el asistente — conserva su pantalla propia y vuelve a «Mi perfil» (decisión CEO SPEC-740).
    const destino = DESTINO_HABILITADO;
    if (yaAceptoVigente && !releer) redirect(destino);

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

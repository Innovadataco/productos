import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminNav } from "@/components/modules/AdminNav";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";
import { WizardProfesionalShell } from "@/components/modules/profesional/WizardProfesionalShell";

/**
 * SPEC-437 (A-75) · la ficha y la verificación también son su área de trabajo.
 * SPEC-740 (bug de Jelkin) · el REGISTRO (profesional NO habilitado) es un asistente
 * multi-paso ESPEJO del `/camino` del padre — pantalla enfocada, sin barra lateral, con
 * indicador «Paso N de 3». El HABILITADO que pasa por acá (p. ej. re-aceptar una
 * autorización nueva) conserva su chrome operativo (barra lateral), no el asistente.
 *
 * Layout de UI pura, como el del admin (SPEC-287): **no ejecuta `redirect`** (la
 * compuerta por estado vive en `guardia-habilitado`).
 */
export default async function PerfilProfesionalLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as string | undefined) ?? "PROFESIONAL";
    const userId = payload?.sub as string | undefined;

    // SPEC-740: el asistente de registro es SOLO para el no habilitado (BORRADOR/VENCIDO/
    // sin perfil). Un habilitado que entra a re-aceptar conserva su área operativa.
    const hab = userId ? await obtenerHabilitacionProfesional(userId) : null;
    if (!hab?.habilitado) {
        return <WizardProfesionalShell>{children}</WizardProfesionalShell>;
    }

    const permitidos = await modulosPermitidosParaRol(rol);
    return (
        <div className="flex min-h-screen">
            <AdminNav rol="PROFESIONAL" modulosPermitidos={[...permitidos]} />
            <main className="flex-1 overflow-auto">{children}</main>
        </div>
    );
}

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { verificarVigenciaCliente } from "@/lib/colegio/vigencia";
import { ServicioVencidoScreen } from "@/components/modules/ServicioVencidoScreen";

/**
 * Guarda de vigencia para el área del padre (SPEC-119). Solo actúa con token PARENT:
 * el resto (anónimo, roles internos) pasa — el proxy y las páginas hacen su propio
 * control de acceso. Un padre vencido ve la pantalla "Servicio no vigente" en vez de
 * sus reportes; sus datos quedan intactos.
 */
export default async function MisReportesLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (token) {
        const payload = await verifyToken(token);
        if (payload?.sub && payload.rol === "PARENT") {
            const vigencia = await verificarVigenciaCliente(payload.sub as string);
            if (!vigencia.vigente) {
                return <ServicioVencidoScreen mensaje={vigencia.mensaje} />;
            }
        }
    }

    return <>{children}</>;
}

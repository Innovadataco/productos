import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { verificarVigenciaCliente } from "@/lib/colegio/vigencia";
import { ServicioVencidoScreen } from "@/components/modules/ServicioVencidoScreen";
import { SessionPingProvider } from "@/components/providers/SessionPingProvider";

/**
 * Layout raíz de /dashboard (SPEC-119): aplica la guarda de vigencia al área del padre
 * (/dashboard, /dashboard/mis-reportes, /dashboard/circulo-confianza, ...). Solo actúa
 * con token PARENT; SCHOOL_ADMIN y roles internos pasan a sus propios layouts anidados
 * (dashboard/colegio ya tiene su guarda de vigencia, dashboard/admin la suya de rol).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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

    return (
        <SessionPingProvider>
            <div className="min-h-screen">{children}</div>
        </SessionPingProvider>
    );
}

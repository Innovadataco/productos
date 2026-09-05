import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { verificarVigenciaCliente } from "@/lib/colegio/vigencia";
import { ServicioVencidoScreen } from "@/components/modules/ServicioVencidoScreen";
import { PadreSideNav } from "@/components/modules/padre/PadreSideNav";
import { PadreNavMovil } from "@/components/modules/padre/PadreNavMovil";
import { Alerta } from "@/components/ui/Alerta";
import { resolverEstadoVigencia, debeMostrarBanner } from "@/lib/pagos/vigencia-middleware";

/**
 * SPEC-440 P3 (Jelkin vivo 04-09) · `/mis-reportes` traía SU PROPIO layout
 * — banner de vigencia y `children` a pelo — mientras que TODAS las demás
 * pantallas del padre (`/dashboard/padre/**`) montan el shell del área:
 * `PadreSideNav` a la izquierda + `PadreNavMovil` en móvil + banner de
 * vigencia en grace. El padre entraba a «Mis reportes» y perdía su menú.
 * Radicado literal: «Todas las pantallas del padre traen la barra "Mi
 * protección"; esta no. Misma barra, mismo componente». Decisión CEO
 * (17:1x): opción (B) — se le AGREGA el sidebar; el shell se reusa exacto
 * del layout `/dashboard/padre/`. En móvil no cambia nada porque
 * `PadreNavMovil` ya sirve a ambos.
 *
 * La guarda de vigencia SPEC-119 sigue activa para PARENT; el resto (anónimo,
 * roles internos que llegan por seguimiento) pasa sin sidebar — el shell del
 * padre solo se pinta si hay usuario cargado. Un padre vencido ve la pantalla
 * "Servicio no vigente" antes de renderizar el shell.
 */
export default async function MisReportesLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    const payload = token ? await verifyToken(token) : null;
    if (payload?.sub && payload.rol === "PARENT") {
        const vigencia = await verificarVigenciaCliente(payload.sub as string);
        if (!vigencia.vigente) {
            return <ServicioVencidoScreen mensaje={vigencia.mensaje} />;
        }
    }

    const usuario = payload?.sub && payload.rol === "PARENT"
        ? await new UsuarioRepository().findSesionPadre(payload.sub as string)
        : null;

    // Sin usuario PARENT (anónimos, roles internos entrando por link de
    // seguimiento) — sin shell del padre. La página se pinta a pelo, como antes.
    if (!usuario) return <>{children}</>;

    const suscripcionActiva = await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(usuario.id);
    const estadoVigencia = resolverEstadoVigencia(suscripcionActiva);

    return (
        <div className="theme-padre flex min-h-screen bg-page">
            <PadreSideNav />
            <PadreNavMovil />
            <main className="min-w-0 flex-1 pb-16 sm:pb-0">
                {debeMostrarBanner(estadoVigencia) && (
                    <div className="px-4 pt-4 sm:px-6">
                        <Alerta tono="advertencia">Tu plan vence pronto. Renueva para no perder el acceso.</Alerta>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { PadreSideNav } from "@/components/modules/padre/PadreSideNav";
import { Alerta } from "@/components/ui/Alerta";
import { resolverEstadoVigencia, debeMostrarBanner } from "@/lib/pagos/vigencia-middleware";

/**
 * SPEC-287 (002-PI-187): layout UI puro. Todos los guardianes de acceso
 * (sesión, consentimiento, cambiar-password, vigencia) viven ahora en
 * `middleware.ts` — este layout NO ejecuta `redirect(...)`. El ratchet
 * `no-redirect-en-layout-de-dashboard` bloquea el merge si vuelve a nacer.
 *
 * Este componente solo:
 *  - lee el usuario (para el sidebar y el banner)
 *  - muestra banner ámbar cuando la vigencia está EN_GRACIA
 *  - renderiza el sidebar y los hijos
 *
 * Si llega hasta aquí sin sesión válida, es un bug del middleware. En ese caso
 * el layout renderiza sin sidebar (usuario null) — mejor que 500 en cascada.
 */
export default async function PadreLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    const payload = token ? await verifyToken(token) : null;
    const usuario = payload?.sub
        ? await new UsuarioRepository().findSesionPadre(payload.sub as string)
        : null;

    const suscripcionActiva = usuario
        ? await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(usuario.id)
        : null;
    const estadoVigencia = resolverEstadoVigencia(suscripcionActiva);

    return (
        <div className="theme-padre flex min-h-screen bg-page">
            <PadreSideNav />
            <main className="min-w-0 flex-1">
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

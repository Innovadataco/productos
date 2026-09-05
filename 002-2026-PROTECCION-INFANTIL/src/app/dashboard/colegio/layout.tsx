import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { ColegioSideNav } from "@/components/modules/colegio/ColegioSideNav";
import { BuscadorGlobal } from "@/components/modules/colegio/BuscadorGlobal";
import { CentroNotificaciones } from "@/components/modules/colegio/CentroNotificaciones";
import { Alerta } from "@/components/ui/Alerta";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import { resolverEstadoVigencia, debeMostrarBanner } from "@/lib/pagos/vigencia-middleware";
import type { RolUsuario } from "@prisma/client";

const ROLES_COLEGIO = new Set<RolUsuario>(["SCHOOL_ADMIN", "COMITE_CONVIVENCIA"]);

/**
 * SPEC-287 (002-PI-187): layout UI puro. Todos los guardianes de acceso
 * (sesión, consentimiento, cambiar-password, vigencia) viven ahora en
 * `middleware.ts`. Este layout NO ejecuta `redirect(...)`.
 */
export default async function ColegioLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    const payload = token ? await verifyToken(token) : null;
    const rol = payload?.rol as RolUsuario | undefined;

    const usuario =
        payload?.sub && rol && ROLES_COLEGIO.has(rol)
            ? rol === "COMITE_CONVIVENCIA"
                ? await new UsuarioRepository().findSesionComite(payload.sub as string)
                : await new UsuarioRepository().findSesionColegio(payload.sub as string)
            : null;

    const suscripcionActiva = usuario
        ? await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(usuario.id)
        : null;
    const estadoVigencia = resolverEstadoVigencia(suscripcionActiva);

    const permitidos = usuario ? await modulosPermitidosParaRol(usuario.rol) : new Set<string>();
    const rolEfectivo = (usuario?.rol ?? "SCHOOL_ADMIN") as RolUsuario;

    return (
        <div className="theme-colegio flex min-h-screen bg-page">
            <ColegioSideNav rol={rolEfectivo} modulosPermitidos={[...permitidos]} />
            <BuscadorGlobal />
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-end gap-3 border-b border-tinta/10 px-4 py-3 sm:px-6">
                    <CentroNotificaciones />
                </header>
                <main className="min-w-0 flex-1">
                    {debeMostrarBanner(estadoVigencia) && (
                        <div className="px-4 pt-4 sm:px-6">
                            <Alerta tono="advertencia">
                                Su plan vence pronto. Renueve para no perder el acceso.
                            </Alerta>
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}

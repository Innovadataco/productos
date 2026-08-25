import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { PadreSideNav } from "@/components/modules/padre/PadreSideNav";
import { Alerta } from "@/components/ui/Alerta";
import {
    resolverEstadoVigencia,
    esRutaExenta,
    redireccionSuscripcion,
    debeMostrarBanner,
} from "@/lib/pagos/vigencia-middleware";

/**
 * Layout del área del padre (`/dashboard/padre/*`).
 * SPEC-231 (002-PI-131): sidebar padre + guarda de sesión PARENT.
 * SPEC-242 (002-PI-145): guarda de vigencia basada en Suscripcion.estado.
 * Encadenamiento: auth → consentimiento (SPEC-241) → vigencia.
 */
export default async function PadreLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!payload?.sub || rol !== "PARENT") {
        redirect("/login");
    }

    const usuario = await new UsuarioRepository().findSesionPadre(payload.sub as string);

    if (!usuario || usuario.estado !== "activo" || usuario.rol !== "PARENT") {
        redirect("/login");
    }

    if (usuario.debeCambiarPassword) {
        redirect("/cambiar-password");
    }

    const pathname = (await headers()).get("x-invoke-path") ?? "";
    const esExenta = esRutaExenta(pathname, "PARENT");

    const suscripcionActiva = await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(usuario.id);
    const estadoVigencia = resolverEstadoVigencia(suscripcionActiva);

    if (!esExenta && estadoVigencia !== "ACTIVA" && estadoVigencia !== "EN_GRACIA") {
        redirect(redireccionSuscripcion("PARENT"));
    }

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

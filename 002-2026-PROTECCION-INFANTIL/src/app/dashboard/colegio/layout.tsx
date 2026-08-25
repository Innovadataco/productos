import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { requiereConsentimientoActual } from "@/lib/consentimiento/guard";
import { ColegioSideNav } from "@/components/modules/colegio/ColegioSideNav";
import { BuscadorGlobal } from "@/components/modules/colegio/BuscadorGlobal";
import { CentroNotificaciones } from "@/components/modules/colegio/CentroNotificaciones";
import { Alerta } from "@/components/ui/Alerta";
import { modulosPermitidosParaRol } from "@/lib/permisos-modulos";
import {
    resolverEstadoVigencia,
    esRutaExenta,
    redireccionSuscripcion,
    debeMostrarBanner,
} from "@/lib/pagos/vigencia-middleware";
import type { RolUsuario } from "@prisma/client";

const ROLES_COLEGIO = new Set<RolUsuario>(["SCHOOL_ADMIN", "COMITE_CONVIVENCIA"]);

/**
 * Layout del área del colegio (`/dashboard/colegio/*`).
 * SPEC-129/148: navegación lateral + buscador global.
 * SPEC-242 (002-PI-145): guarda de vigencia basada en Suscripcion.estado.
 * Reemplaza el bloqueo full-screen legacy por redirección a /dashboard/colegio/suscripcion.
 */
export default async function ColegioLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as RolUsuario | undefined;
    if (!payload?.sub || !rol || !ROLES_COLEGIO.has(rol)) {
        redirect("/login");
    }

    // E-8: la consulta vive en el repo; el componente no toca prisma.
    const usuario =
        rol === "COMITE_CONVIVENCIA"
            ? await new UsuarioRepository().findSesionComite(payload.sub as string)
            : await new UsuarioRepository().findSesionColegio(payload.sub as string);

    if (!usuario || usuario.estado !== "activo" || usuario.rol !== rol) {
        redirect("/login");
    }

    // SPEC-241 (002-PI-144): guardia de consentimiento informado antes de vigencia.
    const requiereConsentimiento = await requiereConsentimientoActual(payload.sub as string);
    if (requiereConsentimiento) {
        redirect("/consentimiento");
    }

    // Enforcement central: cualquier usuario con contraseña temporal debe cambiarla
    // antes de usar su panel (mismo criterio que el comité de validación).
    if (usuario.debeCambiarPassword) {
        redirect("/cambiar-password");
    }

    const pathname = (await headers()).get("x-invoke-path") ?? "";
    const esExenta = esRutaExenta(pathname, rol);

    // SPEC-242: la vigencia del colegio ahora se consume desde Suscripcion,
    // no desde fechas de servicio legacy.
    const suscripcionActiva = await new PagosRepository().obtenerSuscripcionActivaPorUsuarioId(usuario.id);
    const estadoVigencia = resolverEstadoVigencia(suscripcionActiva);

    if (!esExenta && estadoVigencia !== "ACTIVA" && estadoVigencia !== "EN_GRACIA") {
        redirect(redireccionSuscripcion(rol));
    }

    const permitidos = await modulosPermitidosParaRol(usuario.rol);

    return (
        <div className="theme-colegio flex min-h-screen bg-page">
            <ColegioSideNav rol={usuario.rol} modulosPermitidos={[...permitidos]} />
            <BuscadorGlobal />
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-end gap-3 border-b border-tinta/10 px-4 py-3 sm:px-6">
                    <CentroNotificaciones />
                </header>
                <main className="min-w-0 flex-1">
                    {debeMostrarBanner(estadoVigencia) && (
                        <div className="px-4 pt-4 sm:px-6">
                            <Alerta tono="advertencia">
                                Tu plan vence pronto. Renueva para no perder el acceso.
                            </Alerta>
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    );
}

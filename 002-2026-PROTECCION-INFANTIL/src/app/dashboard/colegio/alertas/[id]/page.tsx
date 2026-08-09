import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verifyToken } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { alertaIdParamsSchema } from "@/lib/schemas";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { obtenerDetalleCaso } from "@/lib/colegio/seguimiento";
import type { DetalleCaso } from "@/lib/colegio/seguimiento";
import CasoDetalleClient from "./CasoDetalleClient";

/**
 * SPEC-159 (FR-005) — Seguimiento del caso (detalle de la alerta del colegio).
 * La auth la hace el layout; aquí se lee la sesión para el `colegioId` y TODOS
 * los datos salen de UNA llamada a `obtenerDetalleCaso(colegioId, id)` — 404 si
 * la alerta no existe o es de OTRO colegio (tenant-first E-1).
 */
export default async function CasoDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;

    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    if (!token) redirect("/login");

    const payload = await verifyToken(token);
    if (!payload?.sub) redirect("/login");

    const usuario = await new UsuarioRepository().findSesionColegio(payload.sub as string);
    if (!usuario?.colegioId) redirect("/login");

    const { id } = await params;
    if (!alertaIdParamsSchema.safeParse({ id }).success) notFound();

    let caso: DetalleCaso;
    try {
        caso = await obtenerDetalleCaso(usuario.colegioId, id);
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) notFound();
        throw error;
    }

    return <CasoDetalleClient caso={caso} />;
}

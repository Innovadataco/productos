// SPEC-237 (002-PI-mega-cola): vista de consolidación del comité.
// Server Component: verifica sesión y módulo (COMITE_VALIDACION muta, ADMIN
// lee, PARENT no accede — el proxy ya bloquea /dashboard/admin para PARENT).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { AppError } from "@/lib/errors";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { estadoPermiteAccion, obtenerDetalleConsolidacion } from "@/lib/comite/consolidacion";
import { ConsolidacionClient } from "@/components/modules/comite/consolidacion/ConsolidacionClient";
import type { RolUsuario } from "@prisma/client";

export default async function ConsolidacionPage({
    params,
}: {
    params: Promise<{ expedienteId: string }>;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) redirect("/login");

    const rol = (payload.rol as RolUsuario) ?? "PARENT";
    if (!(await puedeAccederAModulo(rol, "comite_bandeja"))) {
        return <SinAccesoModulo />;
    }

    const { expedienteId } = await params;

    let detalle;
    try {
        detalle = await obtenerDetalleConsolidacion(expedienteId);
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) notFound();
        throw error;
    }

    const puedeActuar = rol === "COMITE_VALIDACION" && estadoPermiteAccion(detalle.informe.estadoAprobacion);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Consolidación de expediente</h1>
                <p className="text-sm text-muted">
                    Revisión colegiada del informe consolidado antes de presentarlo al padre.
                </p>
            </div>
            <ConsolidacionClient detalle={detalle} puedeActuar={puedeActuar} />
        </div>
    );
}

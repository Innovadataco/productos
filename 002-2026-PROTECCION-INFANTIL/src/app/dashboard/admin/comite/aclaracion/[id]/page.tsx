// SPEC-238 (002-PI-mega-cola): vista de la aclaración padre-comité para el
// comité de validación (T021/T022). Server Component: verifica sesión, módulo
// y rol antes de exponer los textos (dato sensible; solo COMITE_VALIDACION).
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { puedeAccederAModulo } from "@/lib/permisos-modulos";
import { AppError } from "@/lib/errors";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { obtenerDetalleAclaracionParaComite } from "@/lib/dal/services/aclaracion-expediente";
import { AclaracionClient } from "@/components/modules/comite/aclaracion/AclaracionClient";
import type { RolUsuario } from "@prisma/client";

export default async function AclaracionComitePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.sub) redirect("/login");

    const rol = (payload.rol as RolUsuario) ?? "PARENT";
    if (rol !== "COMITE_VALIDACION" || !(await puedeAccederAModulo(rol, "comite_bandeja"))) {
        return <SinAccesoModulo />;
    }

    const usuario = await new UsuarioRepository().findById(payload.sub as string);
    if (!usuario) redirect("/login");

    const { id } = await params;

    let aclaracion;
    try {
        aclaracion = await obtenerDetalleAclaracionParaComite(id, {
            comiteColegioId: usuario.comiteColegioId,
        });
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) notFound();
        throw error;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Aclaración del padre</h1>
                <p className="text-sm text-muted">
                    Respuesta del comité a la duda del padre sobre el informe consolidado.
                </p>
            </div>
            <AclaracionClient
                aclaracionId={aclaracion.id}
                expedienteId={aclaracion.expedienteId}
                estado={aclaracion.estado}
                solicitadaEn={aclaracion.solicitadaEn.toISOString()}
                solicitudTexto={aclaracion.solicitudTexto}
                respuestaTexto={aclaracion.respuestaTexto}
                respondidaEn={aclaracion.respondidaEn?.toISOString() ?? null}
            />
        </div>
    );
}

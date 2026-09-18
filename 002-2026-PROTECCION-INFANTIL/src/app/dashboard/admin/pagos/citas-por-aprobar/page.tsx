/**
 * SPEC-713 · Admin · Pagos → «Citas por aprobar».
 *
 * El hueco que midió el CEO: `POST /api/admin/pagos/cita/[id]/activar` existía desde
 * SPEC-395 y NINGUNA pantalla lo llamaba (dev-funcion-construida-sin-cablear). Sin
 * esto, la familia pide y «paga» la cita y el pago no lo puede aprobar nadie: la
 * solicitud queda SIN_CONFIRMAR y vence sola a los 3 días. Esta pantalla lista las
 * solicitudes con pago por aprobar y las cablea a esa ruta.
 *
 * Voz USTED (interno, D-107). La consulta `listarPendientesAprobacionPago` ya existía
 * en el repo (también sin cablear) — solo la conectamos.
 */
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { CitasPorAprobarClient, type CitaPorAprobar } from "@/components/modules/pagos/CitasPorAprobarClient";

export const dynamic = "force-dynamic";

export default async function CitasPorAprobarPage() {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const filas = await new SolicitudCitaRepository().listarPendientesAprobacionPago();
    const items: CitaPorAprobar[] = filas.map((f) => ({
        id: f.id,
        familia: f.padreUsuario.nombre ?? "Una familia",
        profesional: f.profesional.nombreVisible,
        franjaInicio: f.franja.inicio.toISOString(),
        montoTotal: f.montoTotal,
        esperaDesde: f.creadoEn.toISOString(),
    }));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Citas por aprobar</h2>
                <span className="text-sm text-muted">{items.length} solicitud(es)</span>
            </div>
            <p className="rounded-xl bg-ambar/10 px-4 py-3 text-sm text-estado-ambar">
                La familia ya pidió y pagó estas citas. Al aprobar el pago, la solicitud queda pendiente de
                que el profesional la confirme (tiene 48 horas).
            </p>
            <CitasPorAprobarClient items={items} />
        </div>
    );
}

import Link from "next/link";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { ActivarSuscripcionManual } from "@/components/modules/pagos/ActivarSuscripcionManual";
import { Alerta } from "@/components/ui/Alerta";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import type {
    SolicitudPendienteDTO,
    PaginacionDTO,
} from "@/lib/pagos/admin-activacion-manual.types";
import type {
    PagoConSuscripcion,
    SuscripcionConPlanYTitular,
} from "@/lib/dal/repositories/pagos-repository";

interface PageProps {
    searchParams: Promise<{ page?: string; pageSize?: string; q?: string }>;
}

function parsePagination(params: Awaited<PageProps["searchParams"]>) {
    const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize ?? "25", 10) || 25));
    return { page, pageSize };
}

function toQueryString(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") sp.set(key, String(value));
    }
    const qs = sp.toString();
    return qs ? `?${qs}` : "";
}

function mapSolicitud(s: SuscripcionConPlanYTitular): SolicitudPendienteDTO {
    const titular = s.usuario
        ? { id: s.usuario.id, tipo: "PADRE" as const, nombre: s.usuario.nombre ?? "—", email: s.usuario.email }
        : s.colegio
            ? { id: s.colegio.id, tipo: "COLEGIO" as const, nombre: s.colegio.nombre }
            : { id: "", tipo: "PADRE" as const, nombre: "—" };
    return {
        id: s.id,
        estado: s.estado,
        tipoTitular: titular.tipo,
        fechaInicio: s.fechaInicio.toISOString(),
        fechaFin: s.fechaFin.toISOString(),
        plan: { id: s.planActual.id, nombre: s.planActual.nombre, duracion: s.planActual.duracion },
        titular,
    };
}

function clienteNombre(pago: PagoConSuscripcion) {
    if (pago.suscripcion.usuario) {
        return {
            tipo: "PADRE",
            nombre: pago.suscripcion.usuario.nombre ?? "—",
            email: pago.suscripcion.usuario.email,
        };
    }
    if (pago.suscripcion.colegio) {
        return { tipo: "COLEGIO", nombre: pago.suscripcion.colegio.nombre, email: "—" };
    }
    return { tipo: "DESCONOCIDO", nombre: "—", email: "—" };
}

export default async function PendientesPage({ searchParams }: PageProps) {
    const admin = await verifyAuth("ADMIN").catch(() => null);
    if (!admin) return <SinAccesoModulo />;
    await assertModulo(admin, "pagos_admin");

    const params = await searchParams;
    const { page, pageSize } = parsePagination(params);
    const q = params.q?.trim() ?? "";

    let pagos: PagoConSuscripcion[] = [];
    let pagosPagination: PaginacionDTO = { page, pageSize, total: 0, totalPages: 1 };
    let solicitudes: SolicitudPendienteDTO[] = [];
    let solicitudesPagination: PaginacionDTO = { page, pageSize, total: 0, totalPages: 1 };
    let errorPagos: string | null = null;
    let errorSolicitudes: string | null = null;

    const repo = new PagosRepository();

    await Promise.all([
        repo.listarPagosPendientes(
            { q: q || undefined },
            { skip: (page - 1) * pageSize, take: pageSize }
        ).then((r) => {
            pagos = r.items;
            pagosPagination = {
                page,
                pageSize,
                total: r.total,
                totalPages: Math.max(1, Math.ceil(r.total / pageSize)),
            };
        }).catch(() => {
            errorPagos = "No se pudieron cargar los pagos pendientes. Intenta de nuevo.";
        }),
        repo.listarSolicitudesPendientes(
            { q: q || undefined },
            { skip: (page - 1) * pageSize, take: pageSize }
        ).then((r) => {
            solicitudes = r.items.map(mapSolicitud);
            solicitudesPagination = {
                page,
                pageSize,
                total: r.total,
                totalPages: Math.max(1, Math.ceil(r.total / pageSize)),
            };
        }).catch(() => {
            errorSolicitudes = "No se pudieron cargar las solicitudes pendientes. Intenta de nuevo.";
        }),
    ]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">Pagos pendientes de autorización</h2>
                    <p className="text-sm text-muted">Pagos reportados por clientes que esperan confirmación.</p>
                </div>
                <span className="text-sm text-muted">{pagosPagination.total} registro(s)</span>
            </div>

            {errorPagos && (
                <Alerta tono="error" role="alert">
                    {errorPagos}
                </Alerta>
            )}

            <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                <table className="min-w-full text-sm">
                    <thead className="bg-tinta/5 dark:bg-tinta/10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Cliente</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Monto neto USD</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Moneda local</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Método</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Fecha reporte</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                        {pagos.map((pago) => {
                            const cliente = clienteNombre(pago);
                            return (
                                <tr key={pago.id} className="hover:bg-tinta/5 dark:hover:bg-tinta/10">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-body">{cliente.nombre}</div>
                                        <div className="text-xs text-muted">
                                            {cliente.tipo} · {cliente.email}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">${pago.montoNetoUSD.toFixed(2)}</td>
                                    <td className="px-4 py-3">
                                        {pago.monedaLocal} {pago.montoLocalPagado.toLocaleString("es-CO")}
                                    </td>
                                    <td className="px-4 py-3">{pago.metodoDeclarado}</td>
                                    <td className="px-4 py-3">{pago.fechaReporte.toLocaleDateString("es-CO")}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/dashboard/admin/pagos/cliente/${pago.suscripcionId}`}
                                                className="rounded-lg bg-tinta/10 px-3 py-1 text-xs font-medium text-body hover:bg-tinta/20 dark:bg-tinta/15 dark:hover:bg-tinta/25"
                                            >
                                                Ver cliente
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {pagos.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                                    No hay pagos pendientes.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagosPagination.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted">
                    <span>
                        Página {pagosPagination.page} de {pagosPagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                        {pagosPagination.page > 1 && (
                            <Link
                                href={`/dashboard/admin/pagos/pendientes${toQueryString({
                                    page: pagosPagination.page - 1,
                                    pageSize,
                                    q,
                                })}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 transition hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                            >
                                Anterior
                            </Link>
                        )}
                        {pagosPagination.page < pagosPagination.totalPages && (
                            <Link
                                href={`/dashboard/admin/pagos/pendientes${toQueryString({
                                    page: pagosPagination.page + 1,
                                    pageSize,
                                    q,
                                })}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 transition hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                            >
                                Siguiente
                            </Link>
                        )}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">Solicitudes de suscripción pendientes</h2>
                    <p className="text-sm text-muted">Suscripciones creadas por clientes que requieren autorización manual.</p>
                </div>
                <span className="text-sm text-muted">{solicitudesPagination.total} registro(s)</span>
            </div>

            {errorSolicitudes && (
                <Alerta tono="error" role="alert">
                    {errorSolicitudes}
                </Alerta>
            )}

            <div className="overflow-x-auto rounded-xl border border-tinta/10 dark:border-tinta/20">
                <table className="min-w-full text-sm">
                    <thead className="bg-tinta/5 dark:bg-tinta/10">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted">Titular</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Tipo</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Plan</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Fecha solicitud</th>
                            <th className="px-4 py-3 text-left font-medium text-muted">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-tinta/10 dark:divide-tinta/20">
                        {solicitudes.map((s) => (
                            <tr key={s.id} className="hover:bg-tinta/5 dark:hover:bg-tinta/10">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-body">{s.titular.nombre}</div>
                                    <div className="text-xs text-muted">{s.titular.email ?? "—"}</div>
                                </td>
                                <td className="px-4 py-3 text-muted">{s.titular.tipo}</td>
                                <td className="px-4 py-3 text-muted">{s.plan.nombre}</td>
                                <td className="px-4 py-3 text-muted">
                                    {new Date(s.fechaInicio).toLocaleDateString("es-CO")}
                                </td>
                                <td className="px-4 py-3">
                                    <ActivarSuscripcionManual
                                        modo="autorizar"
                                        suscripcionId={s.id}
                                        planNombre={s.plan.nombre}
                                        titularNombre={s.titular.nombre}
                                        titularTipo={s.titular.tipo}
                                    />
                                </td>
                            </tr>
                        ))}
                        {solicitudes.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                                    No hay solicitudes pendientes.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {solicitudesPagination.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted">
                    <span>
                        Página {solicitudesPagination.page} de {solicitudesPagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                        {solicitudesPagination.page > 1 && (
                            <Link
                                href={`/dashboard/admin/pagos/pendientes${toQueryString({
                                    page: solicitudesPagination.page - 1,
                                    pageSize,
                                    q,
                                })}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 transition hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                            >
                                Anterior
                            </Link>
                        )}
                        {solicitudesPagination.page < solicitudesPagination.totalPages && (
                            <Link
                                href={`/dashboard/admin/pagos/pendientes${toQueryString({
                                    page: solicitudesPagination.page + 1,
                                    pageSize,
                                    q,
                                })}`}
                                className="rounded-lg border border-tinta/10 px-3 py-1 transition hover:bg-tinta/5 dark:border-tinta/20 dark:hover:bg-tinta/15"
                            >
                                Siguiente
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

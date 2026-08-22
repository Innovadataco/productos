"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { UsuariosSubNav } from "@/components/modules/admin/UsuariosSubNav";
import { UsuariosKpiCards } from "@/components/modules/admin/UsuariosKpiCards";
import { PadresTable } from "@/components/modules/admin/tables/PadresTable";
import { RectoresTable } from "@/components/modules/admin/tables/RectoresTable";
import { OperadoresTable } from "@/components/modules/admin/tables/OperadoresTable";
import { ComiteConvivenciaTable } from "@/components/modules/admin/tables/ComiteConvivenciaTable";
import { ComiteValidacionTable } from "@/components/modules/admin/tables/ComiteValidacionTable";
import { AdminsTable } from "@/components/modules/admin/tables/AdminsTable";
import type {
    RolUsuariosListado,
    UsuarioListItemDto,
    PaginacionDto,
    KpiRolCard,
    AlertaDashboard,
} from "@/lib/dal/types/usuarios-consolidado";

const PAGE_SIZE = 25;

const ROL_TITULO: Record<RolUsuariosListado, string> = {
    PARENT: "Padres",
    SCHOOL_ADMIN: "Rectores",
    OPERADOR: "Operadores",
    COMITE_CONVIVENCIA: "Comité de convivencia",
    COMITE_VALIDACION: "Comité de validación",
    ADMIN: "Admins",
};

type VistaTablaProps = {
    items: UsuarioListItemDto[];
    pagination: PaginacionDto;
    page: number;
    onPageChange: (page: number) => void;
};

function TablaPorRol({ rol, items, pagination, page, onPageChange }: VistaTablaProps & { rol: RolUsuariosListado }) {
    switch (rol) {
        case "PARENT":
            return <PadresTable items={items as Extract<UsuarioListItemDto, { rol: "PARENT" }>[]} pagination={pagination} page={page} onPageChange={onPageChange} />;
        case "SCHOOL_ADMIN":
            return <RectoresTable items={items as Extract<UsuarioListItemDto, { rol: "SCHOOL_ADMIN" }>[]} pagination={pagination} page={page} onPageChange={onPageChange} />;
        case "OPERADOR":
            return <OperadoresTable items={items as Extract<UsuarioListItemDto, { rol: "OPERADOR" }>[]} pagination={pagination} page={page} onPageChange={onPageChange} />;
        case "COMITE_CONVIVENCIA":
            return <ComiteConvivenciaTable items={items as Extract<UsuarioListItemDto, { rol: "COMITE_CONVIVENCIA" }>[]} pagination={pagination} page={page} onPageChange={onPageChange} />;
        case "COMITE_VALIDACION":
            return <ComiteValidacionTable items={items as Extract<UsuarioListItemDto, { rol: "COMITE_VALIDACION" }>[]} pagination={pagination} page={page} onPageChange={onPageChange} />;
        case "ADMIN":
            return <AdminsTable items={items as Extract<UsuarioListItemDto, { rol: "ADMIN" }>[]} pagination={pagination} page={page} onPageChange={onPageChange} />;
        default:
            return null;
    }
}

export default function UsuariosAdminClient({ rol }: { rol: RolUsuariosListado }) {
    const [items, setItems] = useState<UsuarioListItemDto[]>([]);
    const [pagination, setPagination] = useState<PaginacionDto>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [kpi, setKpi] = useState<KpiRolCard[]>([]);
    const [alertas, setAlertas] = useState<AlertaDashboard[]>([]);
    const [loadingKpi, setLoadingKpi] = useState(true);

    const [q, setQ] = useState("");
    const [estado, setEstado] = useState("");
    const [page, setPage] = useState(1);

    const [filtrosActivos, setFiltrosActivos] = useState({ q: "", estado: "" });

    const cargarKpi = useCallback(async () => {
        setLoadingKpi(true);
        try {
            const res = await fetch("/api/admin/usuarios/dashboard", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setKpi(data.kpi || []);
                setAlertas(data.alertas || []);
            }
        } catch {
            // KPI es secundario; no bloqueamos la tabla.
        } finally {
            setLoadingKpi(false);
        }
    }, []);

    const cargar = useCallback(async (pagina: number, f: { q: string; estado: string }) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagina),
                pageSize: String(PAGE_SIZE),
                rol,
            });
            if (f.q) params.set("q", f.q);
            if (f.estado) params.set("estado", f.estado);

            const res = await fetch(`/api/admin/usuarios?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setItems(data.items || []);
                setPagination(data.pagination || { page: pagina, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
                setMessage(null);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando usuarios" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando usuarios" });
        } finally {
            setLoading(false);
        }
    }, [rol]);

    useEffect(() => {
        setPage(1);
        setFiltrosActivos({ q: "", estado: "" });
        setQ("");
        setEstado("");
        void cargarKpi();
    }, [rol, cargarKpi]);

    useEffect(() => {
        cargar(page, filtrosActivos);
    }, [cargar, page, filtrosActivos]);

    function aplicarFiltros(e: React.FormEvent) {
        e.preventDefault();
        setPage(1);
        setFiltrosActivos({ q: q.trim(), estado });
    }

    function limpiarFiltros() {
        setQ("");
        setEstado("");
        setPage(1);
        setFiltrosActivos({ q: "", estado: "" });
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Usuarios</h1>
                <p className="text-sm text-muted">
                    Vista operativa consolidada por rol. Fuente única de conteos para KPI y tablas.
                </p>
            </div>

            {loadingKpi ? (
                <Cargando inline texto="Cargando KPI..." className="py-4" />
            ) : (
                <UsuariosKpiCards kpi={kpi} alertas={alertas} />
            )}

            <UsuariosSubNav />

            {message && (
                <Alerta tono={message.type === "error" ? "error" : "exito"} className="p-4">
                    {message.text}
                </Alerta>
            )}

            <GlassCard>
                <form onSubmit={aplicarFiltros} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Input label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email o nombre" />
                    <div>
                        <label className="mb-1 block text-sm font-medium text-body">Estado</label>
                        <select
                            value={estado}
                            onChange={(e) => setEstado(e.target.value)}
                            className="w-full rounded-xl border border-tinta/20 bg-papel/70 px-3 py-2 text-sm text-body outline-none focus:border-pino dark:bg-papel/70"
                        >
                            <option value="">Todos</option>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="bloqueado">Bloqueado</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
                        <Button type="submit">Filtrar</Button>
                        {(filtrosActivos.q || filtrosActivos.estado) && (
                            <Button type="button" variant="outline" onClick={limpiarFiltros}>
                                Limpiar
                            </Button>
                        )}
                    </div>
                </form>
            </GlassCard>

            <GlassCard>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-body">{ROL_TITULO[rol]}</h2>
                    {loading && <Cargando inline texto="Cargando..." />}
                </div>
                {loading && items.length === 0 ? (
                    <Cargando inline texto="Cargando usuarios..." className="py-8" />
                ) : items.length === 0 ? (
                    <EmptyState
                        title="Sin resultados"
                        description="No hay usuarios que coincidan con los filtros seleccionados."
                    />
                ) : (
                    <TablaPorRol rol={rol} items={items} pagination={pagination} page={page} onPageChange={setPage} />
                )}
            </GlassCard>
        </div>
    );
}

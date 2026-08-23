import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

const TABS = [
    { href: "/dashboard/admin/pagos/pendientes", label: "Pendientes" },
    { href: "/dashboard/admin/pagos/vencimientos", label: "Vencimientos" },
    { href: "/dashboard/admin/pagos/mora", label: "Mora" },
    { href: "/dashboard/admin/pagos/bonos", label: "Bonos" },
    { href: "/dashboard/admin/pagos/planes", label: "Planes" },
    { href: "/dashboard/admin/pagos/reembolsos", label: "Reembolsos" },
    { href: "/dashboard/admin/pagos/analitica", label: "Analítica" },
];

export default async function PagosLayout({ children }: { children: React.ReactNode }) {
    const acceso = await verificarAccesoPagina("pagos_admin");
    if (!acceso.permitido || !acceso.rol) {
        return <SinAccesoModulo />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-body">Pagos</h1>
                    <p className="text-sm text-muted">Gestión de pagos, suscripciones, bonos y reembolsos.</p>
                </div>
                <span className="self-start rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    Admin
                </span>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs pagos">
                    {TABS.map((tab) => (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className="inline-flex shrink-0 items-center border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted transition hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-700 dark:hover:text-amber-400"
                        >
                            {tab.label}
                        </Link>
                    ))}
                </nav>
            </div>

            {children}
        </div>
    );
}

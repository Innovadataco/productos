import { AdminDashboard } from "@/components/modules/AdminDashboard";
import { DashboardSubNav } from "../components/DashboardSubNav";

export default function AdminEstadisticasOperacionPage() {
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Dashboard</h1>
                <p className="text-sm text-muted">Vista operativa general de reportes, estados y cola de procesamiento.</p>
            </div>
            <DashboardSubNav />
            <AdminDashboard />
        </div>
    );
}

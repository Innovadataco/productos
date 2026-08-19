import { Suspense } from "react";
import { Cargando } from "@/components/ui/Cargando";
import { EstadisticasSubNav } from "../components/EstadisticasSubNav";
import { OperacionTableroClient } from "./OperacionTableroClient";

export default function AdminEstadisticasOperacionPage() {
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* SPEC-179 (I-59): sub-nav del área (Operación · Clasificación · Motor). */}
            <Suspense fallback={null}>
                <EstadisticasSubNav />
            </Suspense>
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Tablero operativo</h1>
                <p className="text-sm text-muted">Salud de la infraestructura y operación de reportes en un solo lugar.</p>
            </div>
            {/* Suspense: OperacionTableroClient lee el tab activo con useSearchParams */}
            <Suspense fallback={<Cargando texto="Cargando tablero..." />}>
                <OperacionTableroClient />
            </Suspense>
        </div>
    );
}

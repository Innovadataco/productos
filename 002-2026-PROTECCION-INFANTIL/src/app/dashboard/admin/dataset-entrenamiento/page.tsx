import { Suspense } from "react";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import DatasetEntrenamientoPageClient from "./DatasetEntrenamientoPageClient";

export default async function DatasetEntrenamientoPage() {
    const acceso = await verificarAccesoPagina("dataset_entrenamiento");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <Suspense fallback={<div className="text-muted">Cargando...</div>}>
            <DatasetEntrenamientoPageClient />
        </Suspense>
    );
}

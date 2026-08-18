import { redirect } from "next/navigation";

/**
 * SPEC-171 (Pilar B): el tablero de Clasificación vive ahora como sub-tab del
 * tablero operativo. La ruta vieja redirige para conservar bookmarks.
 */
export default function AdminEstadisticasClasificacionPage() {
    redirect("/dashboard/admin/estadisticas/operacion?tab=clasificacion");
}

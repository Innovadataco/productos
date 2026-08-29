import { redirect } from "next/navigation";

/**
 * SPEC-180: esta página se retiró del menú — su contenido (worker + BD) quedó
 * cubierto y ampliado por el tablero operativo de SPEC-171 (6 semáforos).
 * La ruta queda como redirect para no romper bookmarks.
 */
export default function MonitoreoWorkerPage() {
    redirect("/dashboard/admin/estadisticas/operacion");
}

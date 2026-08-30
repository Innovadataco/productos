import type { HomePadrePayload } from "@/lib/padre/home";
import { ResumenCirculo } from "./ResumenCirculo";
import { SemaforoResumen } from "./SemaforoResumen";
import { TimelineResumen } from "./TimelineResumen";
import { SugerenciaProactiva } from "./SugerenciaProactiva";
import { AccesosRapidos } from "./AccesosRapidos";

interface HomePadreDashboardProps {
    data: HomePadrePayload;
}

export function HomePadreDashboard({ data }: HomePadreDashboardProps) {
    return (
        <div className="space-y-6 p-6">
            <header>
                <h1 className="text-2xl font-bold text-body">{data.saludo}</h1>
                <p className="text-muted">{data.fechaHoy}</p>
            </header>

            <SugerenciaProactiva sugerencia={data.sugerencia} />

            <div className="grid gap-6 lg:grid-cols-2">
                <ResumenCirculo resumen={data.resumen} />
                <SemaforoResumen contactos={data.semaforo} />
            </div>

            <TimelineResumen eventos={data.timeline} />

            <AccesosRapidos accesos={data.accesos} />
        </div>
    );
}

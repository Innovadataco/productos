import { Badge } from "@/components/ui/Badge";
import type { RespuestaMotor } from "@/lib/bi/tipos";

export function BannerEstado({ respuesta }: { respuesta: RespuestaMotor }) {
    if (respuesta.estado === "OK") {
        return <Badge tono="verde">OK</Badge>;
    }
    if (respuesta.estado === "REVISION") {
        return (
            <div data-testid="banner-revision" className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                <strong>REVISION</strong> · los modelos no concuerdan {respuesta.razon ? `(${respuesta.razon})` : ""}. Aprueba una opción abajo si quieres.
            </div>
        );
    }
    return (
        <div data-testid="banner-rechazado" className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900">
            <strong>RECHAZADO</strong>{respuesta.razon ? ` · ${respuesta.razon}` : ""}
        </div>
    );
}

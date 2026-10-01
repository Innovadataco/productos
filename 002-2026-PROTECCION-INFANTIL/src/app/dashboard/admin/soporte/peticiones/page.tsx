import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { listarBandejaPeticiones } from "@/lib/soporte/bandeja-peticiones.service";
import { BandejaPeticionesClient } from "@/components/modules/admin/BandejaPeticionesClient";

/**
 * SPEC-824 · La bandeja del operador/admin para la Puerta de Soporte. Lista las peticiones ABIERTAS
 * ordenadas por vencimiento real, con lo legal separado y SIN contenido del titular (ver el servicio y el
 * cliente). Es la pieza que hace que la puerta (SPEC-819) pueda ser alcanzable: alguien ve lo que entra.
 *
 * Gated por el módulo `soporte_peticiones` (admin + operador). Copy del encabezado PENDIENTE de Diseño.
 */
export const dynamic = "force-dynamic";

export default async function BandejaPeticionesPage() {
    const acceso = await verificarAccesoPagina("soporte_peticiones");
    if (!acceso.permitido) return <SinAccesoModulo />;

    const data = await listarBandejaPeticiones();
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <header>
                {/* PENDIENTE Diseño (SPEC-824): copy del encabezado. */}
                <h1 className="titular-h1">Peticiones de soporte</h1>
                <p className="cuerpo text-subtle mt-1">Solicitudes abiertas, ordenadas por vencimiento.</p>
            </header>
            <BandejaPeticionesClient data={data} />
        </div>
    );
}

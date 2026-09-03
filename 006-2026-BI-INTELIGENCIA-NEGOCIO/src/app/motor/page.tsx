import Topbar from "@/components/bi/Topbar";
import { getMotor } from "@/lib/bi/salud-motor";
import ServiciosSalud from "@/components/bi/motor/ServiciosSalud";
import GridKpisMotor from "@/components/bi/motor/GridKpisMotor";
import LatenciaEtapa from "@/components/bi/motor/LatenciaEtapa";
import DerivaMotor from "@/components/bi/motor/DerivaMotor";
import CorreccionesTop from "@/components/bi/motor/CorreccionesTop";
import TablasMotor from "@/components/bi/motor/TablasMotor";

// Datos vivos de la réplica en cada request: jamás prerender estático.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Motor (Lote C · 2026-09-03): salud del pipeline de clasificación y de la
 * infraestructura sobre la réplica read-only de PI — ClasificacionIA,
 * pasos_procesamiento, ReintentoReporte, CorreccionAdmin, DerivaMotorSnapshot,
 * HealthProbe, IncidenteInfra y worker_logs. Solo metadatos y latencias;
 * el recorte PII vive en la publicación (02). Candados 9 y 10: cada sondeo
 * degrada a vacío con aviso y cada cifra viene del ResultSet.
 */
export default async function MotorPage() {
    const motor = await getMotor();

    return (
        <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-8">
            <Topbar
                titulo="Motor ·"
                acento="salud del pipeline"
                activo="motor"
                sub="Clasificación, latencias e infraestructura — fuente: réplica de PI"
            />

            <ServiciosSalud senales={motor.infraPorSenal} />
            <GridKpisMotor data={motor} />

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <LatenciaEtapa data={motor} />
                <DerivaMotor data={motor} />
            </div>

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <CorreccionesTop data={motor} />
                <TablasMotor data={motor} />
            </div>
        </main>
    );
}

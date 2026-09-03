import type { ComiteData } from "@/lib/bi/comite";
import { fmtMiles } from "../pulso/formatos";

/**
 * Banner de acción de Comité (Lote B): cuando hay solicitudes pendientes con
 * más de 48 h o alertas escaladas abiertas, las pone en la cara — es la cola
 * que hay que trabajar hoy. Sin cola crítica no se renderiza: ausencia de
 * alarma, no texto tranquilizador. Cifras del ResultSet (candado 10).
 */
export default function BannerAccionComite({ data }: { data: ComiteData }) {
    const { pendientesMas48h, alertasEscaladasAbiertas } = data.kpis;
    if (pendientesMas48h === 0 && alertasEscaladasAbiertas === 0) return null;

    return (
        <div
            role="alert"
            className="glass anim-entrada relative mb-5 overflow-hidden border border-[rgb(var(--rubi-rgb)/0.35)] px-5 py-4 pl-6"
            style={{ "--anim-retardo": "60ms" } as React.CSSProperties}
        >
            <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-1 bg-[rgb(var(--rubi-rgb))]" />
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-estado-rubi">
                <span className="punto punto-bad anim-pulso" />
                Cola del comité que necesita gestión
            </div>
            <p className="mt-2 text-[13.5px] font-semibold leading-snug">
                {pendientesMas48h > 0 && (
                    <>
                        {pendientesMas48h === 1 ? "1 solicitud lleva" : `${fmtMiles(pendientesMas48h)} solicitudes llevan`}{" "}
                        más de 48 h sin resolver
                        {alertasEscaladasAbiertas > 0 && " · "}
                    </>
                )}
                {alertasEscaladasAbiertas > 0 && (
                    <>
                        {alertasEscaladasAbiertas === 1 ? "1 alerta de colegio" : `${fmtMiles(alertasEscaladasAbiertas)} alertas de colegio`} escalada(s) sin gestión
                    </>
                )}
                .
            </p>
        </div>
    );
}

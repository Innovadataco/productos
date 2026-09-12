import { getSegmentacion } from "@/lib/bi/segmentacion";
import { fmtMiles } from "./pulso/formatos";

// Banner global de segmentación (CEO 12-09-2026): sin este predicado los
// tableros muestran un negocio que no existe. Visible en TODA la app (vive
// en el Topbar) con el desglose: un cero aislado invita a quitar el término;
// al lado de los que sí cuentan, se lee como «aún no pasa».
//
// Candado 9: si la consulta falla, NO se renderiza (el hueco se dice, no se
// disfraza de cero). Server Component: se ejecuta en runtime Node por request.
export default async function BannerSegmentacion() {
    let seg: Awaited<ReturnType<typeof getSegmentacion>> | null = null;
    try {
        seg = await getSegmentacion();
    } catch {
        return null;
    }
    if (!seg || seg.total === 0) return null;
    return (
        <div
            className="anim-entrada flex items-center gap-2 rounded-full border border-[rgb(var(--ambar-rgb)/0.35)] bg-[rgb(var(--ambar-rgb)/0.10)] px-3 py-1 text-[12px]"
            style={{ "--anim-retardo": "80ms" } as React.CSSProperties}
            title="«No es trabajo real» = marca en demo_marcado o reporte creado por el ejecutor de simulación. Todo lo que ves en BI incluye estos datos salvo que el panel diga lo contrario."
        >
            <span className="h-1.5 w-1.5 rounded-full bg-estado-ambar" aria-hidden />
            <span className="font-semibold text-estado-ambar">
                {String(seg.pctDemo).replace(".", ",")}% semilla/simulación
            </span>
            <span className="text-muted">
                {fmtMiles(seg.marcados)} marcados · {fmtMiles(seg.simulados)} simulados
            </span>
        </div>
    );
}

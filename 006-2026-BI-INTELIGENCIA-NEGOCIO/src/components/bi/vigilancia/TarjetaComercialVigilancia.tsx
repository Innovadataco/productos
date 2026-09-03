import type { VigilanciaData } from "@/lib/bi/vigilancia";
import CifraAnimada from "../pulso/CifraAnimada";
import { fmtMiles } from "../pulso/formatos";

/* Fill por ventana de vencimiento: cuanto más cerca el vencimiento, más
   caliente el color (rubí 7 d → ámbar 15 d → cielo 30 d). */
const VENTANAS = [
    { clave: "vencen7d", etiqueta: "Vencen en 7 días", fill: "bg-[rgb(var(--rubi-rgb)/0.75)]" },
    { clave: "vencen15d", etiqueta: "Vencen en 15 días", fill: "bg-[rgb(var(--ambar-rgb)/0.75)]" },
    { clave: "vencen30d", etiqueta: "Vencen en 30 días", fill: "bg-[rgb(var(--cielo-rgb)/0.75)]" },
] as const;

/**
 * Tarjeta-monitor "Comercial" (marco de vigilancia, Lote 1): suscripciones
 * por vencer en 7/15/30 días — la cartera que hay que llamar YA — más el
 * pulso de padres freemium/premium activos. Candado 10: toda cifra sale de
 * VigilanciaData.comercial; el ancho de cada fill es solo la proporción de
 * presentación contra la ventana más cargada (todo en cero → barras en
 * cero, un hecho real del ResultSet, no un hueco disfrazado).
 */
export default function TarjetaComercialVigilancia({
    comercial,
    retardo = 0,
}: {
    comercial: VigilanciaData["comercial"];
    retardo?: number;
}) {
    const referencia = Math.max(comercial.vencen7d, comercial.vencen15d, comercial.vencen30d);
    const hayVencimientos = referencia > 0;

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <div className="mb-1 flex items-center gap-2">
                <span
                    className={`punto ${
                        comercial.vencen7d > 0 ? "punto-bad anim-pulso" : "punto-ok"
                    }`}
                />
                <h3 className="text-[16.5px] font-semibold">Comercial</h3>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                Suscripciones por vencer y planes activos
            </div>

            <ul className="flex flex-col gap-2.5">
                {VENTANAS.map((v, i) => {
                    const total = comercial[v.clave];
                    return (
                        <li
                            key={v.clave}
                            className="grid grid-cols-[minmax(0,150px)_1fr_56px] items-center gap-3 text-[13.5px]"
                        >
                            <span className="truncate">{v.etiqueta}</span>
                            <div className="h-[22px] overflow-hidden rounded-lg bg-[rgb(var(--tinta-rgb)/0.06)]">
                                <div
                                    className={`barra-crece-x h-full rounded-lg ${v.fill}`}
                                    style={
                                        {
                                            width: `${hayVencimientos ? Math.round((total / referencia) * 100) : 0}%`,
                                            "--anim-retardo": `${retardo + 120 + i * 60}ms`,
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                            <span
                                className={`cifra text-right font-bold ${
                                    v.clave === "vencen7d" && total > 0 ? "text-estado-rubi" : ""
                                }`}
                            >
                                {fmtMiles(total)}
                            </span>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[rgb(var(--tinta-rgb)/0.08)] pt-4">
                <div>
                    <div className="cifra text-[28px] font-bold leading-none tracking-tight">
                        <CifraAnimada valor={comercial.freemiumActivo} />
                    </div>
                    <div className="microetiqueta mt-1.5">Freemium activos</div>
                </div>
                <div>
                    <div className="cifra text-[28px] font-bold leading-none tracking-tight text-estado-pino">
                        <CifraAnimada valor={comercial.premiumActivo} />
                    </div>
                    <div className="microetiqueta mt-1.5">Premium activos</div>
                </div>
            </div>
        </div>
    );
}

import type { ComercialData } from "@/lib/bi/comercial";
import { fmtCOP, fmtMiles } from "../pulso/formatos";

/** Etiquetas legibles para los métodos de pago declarados (enum de PI). */
const ETIQUETAS_METODO: Record<string, string> = {
    TRANSFERENCIA: "Transferencia",
    NEQUI: "Nequi",
    DAVIPLATA: "Daviplata",
    PSE_MANUAL: "PSE manual",
    EFECTIVO: "Efectivo",
    CHEQUE: "Cheque",
    OTRO: "Otro",
};

/**
 * Recaudo por método de pago (Lote A): barras horizontales con COP exacto.
 * La capa de datos devuelve null cuando no hay pagos declarados — esta
 * tarjeta dice su vacío (candado 9) en vez de pintar un eje de ceros.
 */
export default function RecaudoMetodo({ data }: { data: ComercialData }) {
    const filas = data.recaudoPorMetodo;
    const max = Math.max(...(filas ?? []).map((f) => f.total), 1);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "540ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Recaudo por método de pago</h3>
            <div className="mb-4 text-[13px] text-muted">Método declarado en las altas manuales autorizadas</div>
            {filas === null ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay pagos declarados en la réplica — el reparto por método aparece con el primer
                    recaudo registrado.
                </p>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {filas.map((f, i) => (
                        <div
                            key={f.metodo}
                            className="grid grid-cols-[minmax(0,130px)_1fr_110px] items-center gap-2.5 text-[13px]"
                            title={`${f.metodo}: ${fmtCOP(f.total)} en ${fmtMiles(f.cantidad)} pago(s)`}
                        >
                            <span className="truncate">{ETIQUETAS_METODO[f.metodo] ?? f.metodo}</span>
                            <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                <div
                                    className="barra-crece-x h-full rounded-md"
                                    style={
                                        {
                                            width: `${(f.total / max) * 100}%`,
                                            background:
                                                "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                            "--anim-retardo": `${i * 60}ms`,
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                            <span className="cifra text-right text-[12.5px] font-semibold">{fmtCOP(f.total)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

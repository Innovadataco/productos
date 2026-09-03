import type { ComercialData } from "@/lib/bi/comercial";

/**
 * Banner de acción de Comercial (Lote A): cuando hay vencimientos en los
 * próximos 7 días o suscripciones en gracia, los pone en la cara con nombre
 * de titular, plan y día — es la llamada a la acción ("llama a estos").
 * Sin nada próximo no estorba: no se renderiza (no es texto tranquilizador,
 * es ausencia de alarma). Cifras y nombres del ResultSet (candado 10); los
 * nombres de colegio son visibles solo para el CEO (decisión ARQ_07).
 */
export default function BannerAccionComercial({ data }: { data: ComercialData }) {
    const hayGracia = data.kpis.enGracia > 0;
    const proximos = data.vencen7Dias;
    if (!hayGracia && proximos.length === 0) return null;

    const detalle = proximos
        .slice(0, 3)
        .map((v) => `${v.titular} (${v.plan ?? "plan sin nombre"} · vence ${v.venceEn})`)
        .join(" · ");

    return (
        <div
            role="alert"
            className="glass anim-entrada relative mb-5 overflow-hidden border border-[rgb(var(--ambar-rgb)/0.35)] px-5 py-4 pl-6"
            style={{ "--anim-retardo": "60ms" } as React.CSSProperties}
        >
            <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-1 bg-[rgb(var(--ambar-rgb))]" />
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-estado-ambar">
                <span className="punto punto-warn anim-pulso" />
                {hayGracia ? "Cobranza que necesita gestión" : "Vencimientos de la semana"}
            </div>
            <p className="mt-2 text-[13.5px] font-semibold leading-snug">
                {hayGracia && <>{data.kpis.enGracia === 1 ? "1 suscripción en" : `${data.kpis.enGracia} suscripciones en`} gracia — riesgo de suspensión. </>}
                {proximos.length > 0 && (
                    <>
                        {proximos.length === 1 ? "1 suscripción vence" : `${proximos.length} suscripciones vencen`} en los
                        próximos 7 días.
                    </>
                )}
            </p>
            {detalle && <p className="cifra mt-1.5 text-[12.5px] text-muted">{detalle}</p>}
        </div>
    );
}

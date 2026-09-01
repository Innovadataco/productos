import type { PulsoData } from "@/lib/bi/pulso";
import { fmtMiles } from "./formatos";

/**
 * Split de anonimato (mockup v3 pantalla 1): barra apilada cielo/ámbar con
 * la proporción real anónimos vs. identificados. Los anchos se calculan del
 * par que trae la capa de datos; si no hay reportes (0 + 0) se dice "aún
 * sin datos" en vez de pintar una barra vacía como si midiera algo
 * (candado 9).
 */
export default function SplitAnonimato({
    anonimato,
    retardo = 780,
}: {
    anonimato: PulsoData["anonimato"];
    retardo?: number;
}) {
    const total = anonimato.anonimos + anonimato.identificados;
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Anonimato</h3>
            <div className="mb-4 text-[13px] text-muted">Quién reporta</div>
            {total === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-muted">
                    Aún sin reportes para distinguir quién reporta.
                </p>
            ) : (
                <>
                    <div
                        className="flex h-[26px] overflow-hidden rounded-full"
                        role="img"
                        aria-label={`Anónimos ${fmtMiles(anonimato.anonimos)}, identificados ${fmtMiles(anonimato.identificados)}`}
                    >
                        <div
                            className="barra-crece-x bg-[rgb(var(--cielo-rgb))]"
                            style={{ width: `${(anonimato.anonimos / total) * 100}%` }}
                        />
                        <div
                            className="barra-crece-x bg-[rgb(var(--ambar-rgb))]"
                            style={{ width: `${(anonimato.identificados / total) * 100}%`, transformOrigin: "right" }}
                        />
                    </div>
                    <div className="mt-2.5 flex justify-between text-[13px]">
                        <span>
                            Anónimos{" "}
                            <b className="cifra font-semibold">{fmtMiles(anonimato.anonimos)}</b>
                        </span>
                        <span>
                            Identificados{" "}
                            <b className="cifra font-semibold">{fmtMiles(anonimato.identificados)}</b>
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}

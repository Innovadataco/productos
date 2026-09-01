import type { GeoData } from "@/lib/bi/geo";
import Embudo from "../pulso/Embudo";

/**
 * Reincidencia de vigilados (mockup v3 pantalla 3): el mismo identificador
 * en varios reportes, como embudo (únicos → 2+ → 5+ → multi-ciudad). El
 * aviso de presunción de inocencia es parte del diseño aprobado.
 *
 * Candado 9 según el contrato: fuente 'honesto_vacio' significa que el
 * agregado de la réplica es demasiado delgado para mostrarse como
 * estadística — se dice "aún sin datos suficientes" y no se pinta embudo.
 */
export default function EmbudoReincidencia({
    reincidencia,
    retardo = 200,
}: {
    reincidencia: GeoData["reincidencia"];
    retardo?: number;
}) {
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Reincidencia de vigilados</h3>
            <div className="mb-4 text-[13px] text-muted">
                El mismo identificador en varios reportes · agregado sin PII
            </div>
            {reincidencia.fuente === "honesto_vacio" ? (
                <p className="py-6 text-center text-[13.5px] text-muted">
                    Aún sin datos suficientes: el agregado público de identificadores es
                    demasiado delgado para mostrar reincidencia como estadística.
                </p>
            ) : (
                <Embudo
                    pasos={[
                        { etiqueta: "Identificadores únicos", total: reincidencia.unicos },
                        { etiqueta: "Con 2+ reportes", total: reincidencia.con2mas },
                        { etiqueta: "Con 5+ reportes", total: reincidencia.con5mas },
                        { etiqueta: "Multi-ciudad", total: reincidencia.multiCiudad },
                    ]}
                    base={reincidencia.unicos}
                    retardoBase={retardo}
                />
            )}
            <p className="aviso-honesto">
                Presunción de inocencia: el tablero agrega y ordena; jamás lista nombres ni
                nicks en claro.
            </p>
        </div>
    );
}

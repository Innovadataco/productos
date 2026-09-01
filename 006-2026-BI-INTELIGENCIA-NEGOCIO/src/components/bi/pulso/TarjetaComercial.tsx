import type { PulsoData } from "@/lib/bi/pulso";
import BarrasHorizontales from "./BarrasHorizontales";

/**
 * Comercial (mockup v3 pantalla 1): suscripciones vivas de la réplica.
 * El aviso honesto es parte del diseño aprobado: el contrato NO trae recaudo
 * (la carga demo no sembró cobros) y eso se dice tal cual — jamás un "$0"
 * presentado como cifra medida (candados 9 y 10). Todo en ceros → nota de
 * vacío en vez de barras mudas.
 */
export default function TarjetaComercial({
    comercial,
    retardo = 900,
}: {
    comercial: PulsoData["comercial"];
    retardo?: number;
}) {
    const haySuscripciones =
        comercial.colegiosActivos + comercial.padresPremium + comercial.padresFreemium > 0;
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Comercial</h3>
            <div className="mb-4 text-[13px] text-muted">Suscripciones vivas</div>
            {haySuscripciones ? (
                <BarrasHorizontales
                    filas={[
                        { etiqueta: "Colegios activos", total: comercial.colegiosActivos },
                        { etiqueta: "Padres premium", total: comercial.padresPremium },
                        { etiqueta: "Padres freemium", total: comercial.padresFreemium },
                    ]}
                    retardoBase={retardo}
                />
            ) : (
                <p className="py-6 text-center text-[13.5px] text-muted">
                    Aún no hay suscripciones replicadas — ni de colegios ni de padres.
                </p>
            )}
            <p className="aviso-honesto">
                El recaudo no aparece en esta tarjeta: la carga demo no sembró cobros. Cuando PI
                registre pagos reales y la réplica los traiga, se mostrarán aquí.
            </p>
        </div>
    );
}

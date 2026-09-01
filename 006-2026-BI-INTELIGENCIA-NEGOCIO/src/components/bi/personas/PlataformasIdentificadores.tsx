import type { PersonasData } from "@/lib/bi/personas";
import BarrasHorizontales from "../pulso/BarrasHorizontales";

/**
 * Identificadores por plataforma (mockup v3 pantalla 2): dónde viven las
 * cuentas vigiladas, en barras horizontales. La nota de privacidad es parte
 * del diseño aprobado: los nicks NUNCA se muestran en claro — BI agrega y
 * cuenta; el valor del identificador queda fuera de la réplica (Ley 1581
 * de 2012). Vacío → nota honesta (candado 9).
 */
export default function PlataformasIdentificadores({
    identificadoresPorPlataforma,
    retardo = 500,
}: {
    identificadoresPorPlataforma: PersonasData["identificadoresPorPlataforma"];
    retardo?: number;
}) {
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Identificadores por plataforma</h3>
            <div className="mb-4 text-[13px] text-muted">Dónde viven las cuentas vigiladas</div>
            {identificadoresPorPlataforma.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay identificadores vigilados en la réplica.
                </p>
            ) : (
                <BarrasHorizontales
                    filas={identificadoresPorPlataforma.map((p) => ({
                        etiqueta: p.plataforma,
                        total: p.total,
                    }))}
                    retardoBase={retardo}
                />
            )}
            <p className="aviso-honesto aviso-honesto-ambar">
                Los nicks NUNCA se muestran en claro: BI agrega y cuenta. El valor del
                identificador queda fuera de la réplica (Ley 1581).
            </p>
        </div>
    );
}

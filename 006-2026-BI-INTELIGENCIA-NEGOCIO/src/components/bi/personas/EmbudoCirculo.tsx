import type { PersonasData } from "@/lib/bi/personas";
import Embudo from "../pulso/Embudo";

/**
 * Círculo de confianza de los padres (mockup v3 pantalla 2): embudo del
 * frente familia — hijos registrados → contactos de confianza →
 * identificadores de hijo. Los anchos son proporción de los hijos
 * registrados (base del embudo).
 *
 * Contexto: el paso "Con vínculo a padre" se eliminó el 03-09-2026
 * (auditoría DEFECTO 1): su fuente (HijoPadre) quedó obsoleta en PI desde
 * SPEC-339 y medía 2 de 25 cuando la verdad era 25 de 25; el vínculo real
 * (Hijo.usuarioId) no se publica en la réplica.
 *
 * Candado 9 con texto del mockup aprobado: si la réplica no tiene familias
 * (hijos = 0) el embudo no se pinta; en su lugar se dice que el demo no
 * sembró padres y que el módulo cobra vida solo cuando haya datos reales.
 */
export default function EmbudoCirculo({
    circulo,
    retardo = 440,
}: {
    circulo: PersonasData["circulo"];
    retardo?: number;
}) {
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Círculo de confianza (padres)</h3>
            <div className="mb-4 text-[13px] text-muted">Embudo del frente familia</div>
            {circulo.hijos === 0 ? (
                <p className="aviso-honesto mt-0">
                    Honesto: la réplica no tiene padres con círculo de confianza cargado — este
                    módulo muestra solo datos reales. Cuando haya familias en la operación, este
                    embudo cobra vida solo.
                </p>
            ) : (
                <>
                    <Embudo
                        pasos={[
                            { etiqueta: "Hijos registrados", total: circulo.hijos },
                            { etiqueta: "Contactos de confianza", total: circulo.contactos },
                            { etiqueta: "Identificadores de hijo", total: circulo.identificadoresHijo },
                        ]}
                        base={circulo.hijos}
                        retardoBase={retardo}
                    />
                </>
            )}
        </div>
    );
}

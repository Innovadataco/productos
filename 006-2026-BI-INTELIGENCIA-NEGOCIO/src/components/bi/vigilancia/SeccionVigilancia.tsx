import type { VigilanciaData } from "@/lib/bi/vigilancia";
import TarjetaCicloVida from "./TarjetaCicloVida";
import TarjetaMotor from "./TarjetaMotor";
import TarjetaComercialVigilancia from "./TarjetaComercialVigilancia";
import TarjetaAntifraude from "./TarjetaAntifraude";

/**
 * Sección "Vigilancia" del Pulso (marco de vigilancia, Lote 1): cuatro
 * tarjetas-monitor que miran la SALUD del sistema por encima de los KPIs de
 * negocio — ciclo de vida del reporte, motor de clasificación, comercial y
 * antifraude. Se renderiza SIEMPRE (también con la réplica vacía): cada
 * tarjeta dice su vacío honesto en vez de desaparecer (candado 9, mismo
 * criterio que TarjetaCapacidad).
 *
 * Candado 10: esta sección no calcula nada — reparte VigilanciaData a las
 * tarjetas y solo decide el punto de la cabecera (ámbar si alguna señal
 * pide atención). Server component puro; la única isla client sigue siendo
 * CifraAnimada dentro de las tarjetas.
 *
 * vigilancia=null (la réplica no respondió): la sección no desaparece ni
 * inventa cifras — muestra su aviso honesto de "sin lectura" (candado 9).
 */
export default function SeccionVigilancia({
    vigilancia,
}: {
    vigilancia: VigilanciaData | null;
}) {
    if (vigilancia === null) {
        return (
            <section aria-label="Vigilancia del sistema" className="mb-7">
                <div
                    className="microetiqueta anim-entrada mb-3 flex items-center gap-2"
                    style={{ "--anim-retardo": "320ms" } as React.CSSProperties}
                >
                    <span className="punto punto-warn anim-pulso" />
                    Vigilancia · señales del sistema
                </div>
                <div
                    className="glass anim-entrada p-6"
                    style={{ "--anim-retardo": "360ms" } as React.CSSProperties}
                >
                    <p className="text-[13.5px] text-muted">
                        No se pudo leer la réplica: los cuatro monitores de vigilancia quedan
                        sin lectura en esta carga. Ninguna cifra de esta sección está
                        disponible — se reintenta en la próxima visita.
                    </p>
                </div>
            </section>
        );
    }

    const enAtencion =
        vigilancia.cicloVida.atascados > 0 ||
        vigilancia.motorCaido.sospecha ||
        vigilancia.comercial.vencen7d > 0 ||
        vigilancia.antifraude.rafagas48h > 0;

    return (
        <section aria-label="Vigilancia del sistema" className="mb-7">
            <div
                className="microetiqueta anim-entrada mb-3 flex items-center gap-2"
                style={{ "--anim-retardo": "320ms" } as React.CSSProperties}
            >
                <span className={`punto anim-pulso ${enAtencion ? "punto-warn" : "punto-ok"}`} />
                Vigilancia · señales del sistema
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <TarjetaCicloVida cicloVida={vigilancia.cicloVida} retardo={360} />
                <TarjetaMotor motorCaido={vigilancia.motorCaido} retardo={420} />
                <TarjetaComercialVigilancia comercial={vigilancia.comercial} retardo={480} />
                <TarjetaAntifraude antifraude={vigilancia.antifraude} retardo={540} />
            </div>
        </section>
    );
}

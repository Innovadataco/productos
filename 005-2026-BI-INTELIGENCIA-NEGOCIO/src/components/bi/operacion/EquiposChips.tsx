import { Equipo, claseEstadoPersona } from "@/lib/bi/operacion";

interface Props {
    equipos?: Equipo[] | null;
}

// Estados conocidos: se muestra solo el nombre. Desconocido: nombre + texto
// crudo del estado en color neutro (contrato §4 · no rompe).
const CONOCIDOS = new Set(["libre", "en_proceso", "ocupado", "sin_sesion"]);

export function EquiposChips({ equipos }: Props) {
    if (!equipos || equipos.length === 0) {
        return (
            <div className="crew">
                <div className="grp">
                    <span className="gl">Equipos</span>
                    <span className="who off">
                        <i />
                        <span>sin datos</span>
                    </span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="crew">
                {equipos.map((eq, i) => (
                    <div className="grp" key={`${eq.equipo}-${i}`}>
                        <span className="gl">{eq.equipo}</span>
                        {(eq.personas ?? []).map((p, j) => {
                            const clase = claseEstadoPersona(p.estado);
                            const desconocido = !CONOCIDOS.has(p.estado);
                            return (
                                <span className={`who ${clase}`} key={`${p.nombre}-${j}`}>
                                    <i />
                                    <b>{p.nombre}</b>
                                    {desconocido ? (
                                        <span>{p.estado}</span>
                                    ) : p.nota ? (
                                        <span>{p.nota}</span>
                                    ) : null}
                                </span>
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="key">
                <span>
                    <i style={{ background: "var(--libre)" }} />
                    Libre
                </span>
                <span>
                    <i style={{ background: "var(--proceso)" }} />
                    En proceso
                </span>
                <span>
                    <i style={{ background: "var(--ocupado)" }} />
                    Ocupado o congelado
                </span>
                <span>
                    <i style={{ background: "var(--off)" }} />
                    Sin sesión
                </span>
            </div>
        </>
    );
}

import type { PersonasData } from "@/lib/bi/personas";
import TarjetaKpi from "../pulso/TarjetaKpi";
import { fmtMiles } from "../pulso/formatos";

/**
 * Grid de los 4 KPIs de personas (mockup v3 pantalla 2): profesores, alumnos,
 * acudientes e identificadores vigilados. Todo sale de PersonasData; donde
 * el contrato no trae comparación el delta dice "sin comparación", jamás un
 * dato inventado (candado 9). El KPI de identificadores lleva el brillo de
 * "recién llegado", como en el mockup aprobado.
 */
/**
 * Pie con el desglose semilla/real (CEO 12-09): en la mezcla el número
 * «casi legítimo» es donde el falso más se disfraza — «N semilla · M reales»
 * deja a los pocos reales visibles. Solo cuando hay semilla que contar.
 */
function deltaDemo(total: number, demo: number): { texto: string; tipo: "flat" } {
    return {
        texto: `${fmtMiles(demo)} semilla · ${fmtMiles(total - demo)} reales`,
        tipo: "flat",
    };
}

export default function GridKpisPersonas({ personas }: { personas: PersonasData }) {
    return (
        <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpi
                etiqueta="Profesores"
                valor={personas.profesores}
                delta={
                    personas.demo.profesores > 0
                        ? deltaDemo(personas.profesores, personas.demo.profesores)
                        : personas.profesoresVigilados > 0
                          ? {
                                texto: `${fmtMiles(personas.profesoresVigilados)} con cuentas vigiladas`,
                                tipo: "flat",
                            }
                          : { texto: "sin cuentas vigiladas aún", tipo: "flat" }
                }
                retardo={80}
            />
            <TarjetaKpi
                etiqueta="Alumnos"
                valor={personas.alumnos}
                delta={
                    personas.demo.alumnos > 0
                        ? deltaDemo(personas.alumnos, personas.demo.alumnos)
                        : { texto: "matrícula replicada de PI", tipo: "flat" }
                }
                retardo={140}
            />
            <TarjetaKpi
                etiqueta="Acudientes"
                valor={personas.acudientes}
                delta={
                    personas.demo.acudientes > 0
                        ? deltaDemo(personas.acudientes, personas.demo.acudientes)
                        : personas.acudientesMadres + personas.acudientesPadres > 0
                          ? {
                                texto: `${fmtMiles(personas.acudientesMadres)} madres · ${fmtMiles(personas.acudientesPadres)} padres`,
                                tipo: "flat",
                            }
                          : { texto: "sin desagregación madre/padre", tipo: "flat" }
                }
                retardo={200}
            />
            <TarjetaKpi
                etiqueta="Identificadores vigilados"
                valor={personas.identificadores.total}
                delta={{
                    texto: `alumnos ${fmtMiles(personas.identificadores.alumnos)} · acudientes ${fmtMiles(personas.identificadores.acudientes)} · profes ${fmtMiles(personas.identificadores.profesores)}`,
                    tipo: "up",
                }}
                retardo={260}
                brilloNuevo
            />
        </div>
    );
}

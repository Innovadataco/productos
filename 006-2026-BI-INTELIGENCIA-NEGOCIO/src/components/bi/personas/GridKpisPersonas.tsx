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
export default function GridKpisPersonas({ personas }: { personas: PersonasData }) {
    return (
        <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpi
                etiqueta="Profesores"
                valor={personas.profesores}
                delta={
                    personas.profesoresVigilados > 0
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
                delta={{ texto: "matrícula replicada de PI", tipo: "flat" }}
                retardo={140}
            />
            <TarjetaKpi
                etiqueta="Acudientes"
                valor={personas.acudientes}
                delta={
                    personas.acudientesMadres + personas.acudientesPadres > 0
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

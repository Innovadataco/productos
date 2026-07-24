"use client";

import { useState } from "react";
import EntregablesProyecto from "@/components/proyectos/EntregablesProyecto";
import PanelColeccion from "@/components/proyectos/PanelColeccion";
import PanelPresupuesto from "@/components/proyectos/PanelPresupuesto";
import { TIPOS_RECURSO } from "@/lib/proyectoPm2";

/**
 * Gestión PM2 de un proyecto: entregables, cronograma, presupuesto, recursos y
 * lecciones (spec 008, US3–US6).
 *
 * Van en pestañas y no apiladas porque son cinco colecciones dentro de un modal:
 * apiladas obligarían a desplazarse por todas para llegar a una.
 */

interface Hito {
  id: string;
  nombre: string;
  fecha: string;
  fechaFin: string | null;
}

interface Recurso {
  id: string;
  nombre: string;
  rol: string;
  tipo: string;
  costo: string | number;
  disponibilidad: string;
}

interface Leccion {
  id: string;
  descripcion: string;
  categoria: string;
  impacto: string;
}

const PESTANAS = ["Entregables", "Cronograma", "Presupuesto", "Recursos", "Lecciones"] as const;
type Pestana = (typeof PESTANAS)[number];

const fecha = (valor: string | null) =>
  valor ? new Date(valor).toLocaleDateString("es-CO") : "";

export default function GestionPm2({ proyectoId }: { proyectoId: string }) {
  const [activa, setActiva] = useState<Pestana>("Entregables");

  return (
    <div className="space-y-3 pt-4 border-t border-white/10">
      <div className="flex flex-wrap gap-1">
        {PESTANAS.map((pestana) => (
          <button
            key={pestana}
            type="button"
            onClick={() => setActiva(pestana)}
            className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${
              activa === pestana
                ? "text-neonCyan border-b border-neonCyan"
                : "text-white/30 hover:text-white"
            }`}
          >
            {pestana}
          </button>
        ))}
      </div>

      {activa === "Entregables" && <EntregablesProyecto proyectoId={proyectoId} />}

      {activa === "Cronograma" && (
        <PanelColeccion<Hito>
          proyectoId={proyectoId}
          recurso="hitos"
          titulo="Cronograma"
          vacio="Sin hitos todavía"
          campos={[
            { nombre: "nombre", etiqueta: "Hito o actividad", ancho: true, requerido: true },
            { nombre: "fecha", etiqueta: "Fecha", tipo: "date", requerido: true },
            { nombre: "fechaFin", etiqueta: "Fin (opcional)", tipo: "date" },
          ]}
          render={(hito) => (
            <>
              <p className="text-xs font-bold truncate">{hito.nombre}</p>
              <p className="text-[9px] text-[#666] uppercase tracking-widest">
                {fecha(hito.fecha)}
                {hito.fechaFin ? ` → ${fecha(hito.fechaFin)}` : ""}
              </p>
            </>
          )}
        />
      )}

      {activa === "Presupuesto" && <PanelPresupuesto proyectoId={proyectoId} />}

      {activa === "Recursos" && (
        <PanelColeccion<Recurso>
          proyectoId={proyectoId}
          recurso="recursos"
          titulo="Recursos"
          vacio="Sin recursos todavía"
          campos={[
            { nombre: "nombre", etiqueta: "Nombre", ancho: true, requerido: true },
            { nombre: "rol", etiqueta: "Rol" },
            { nombre: "tipo", etiqueta: "Tipo", tipo: "select", opciones: TIPOS_RECURSO },
            { nombre: "costo", etiqueta: "Costo / tarifa", tipo: "number" },
            { nombre: "disponibilidad", etiqueta: "Disponibilidad" },
          ]}
          render={(recurso) => (
            <>
              <p className="text-xs font-bold truncate">{recurso.nombre}</p>
              <p className="text-[9px] text-[#666] uppercase tracking-widest">
                {recurso.tipo}
                {recurso.rol ? ` · ${recurso.rol}` : ""}
                {recurso.disponibilidad ? ` · ${recurso.disponibilidad}` : ""}
              </p>
            </>
          )}
        />
      )}

      {activa === "Lecciones" && (
        <PanelColeccion<Leccion>
          proyectoId={proyectoId}
          recurso="lecciones"
          titulo="Lecciones aprendidas"
          vacio="Sin lecciones todavía"
          campos={[
            { nombre: "descripcion", etiqueta: "Lección aprendida", ancho: true, requerido: true },
            { nombre: "categoria", etiqueta: "Categoría" },
            { nombre: "impacto", etiqueta: "Impacto" },
          ]}
          render={(leccion) => (
            <>
              <p className="text-xs truncate">{leccion.descripcion}</p>
              {(leccion.categoria || leccion.impacto) && (
                <p className="text-[9px] text-[#666] uppercase tracking-widest">
                  {[leccion.categoria, leccion.impacto].filter(Boolean).join(" · ")}
                </p>
              )}
            </>
          )}
        />
      )}
    </div>
  );
}

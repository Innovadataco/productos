"use client";
import ProjectsPage from "@/app/projects/page";
import TableroProyectos from "@/components/proyectos/TableroProyectos";

/**
 * Enrutado de los submódulos de Proyectos (spec 008).
 *
 * Antes recibía `submoduleId` y lo ignoraba: cualquier submódulo devolvía el
 * listado (y la variable sin usar era además un `no-unused-vars` de la línea
 * base).
 */
export default function ProyectosTab({ submoduleId }: { submoduleId: string }) {
  switch (submoduleId) {
    case "fases":
      return <TableroProyectos />;
    case "listado":
    default:
      return <ProjectsPage />;
  }
}

import { redirect } from "next/navigation";

/**
 * SPEC-167 (FR-009) — El Tablero se elimina como pantalla funcional;
 * cualquier enlace guardado termina en Inicio.
 */
export default function TableroRedirectPage() {
    redirect("/dashboard/colegio");
}

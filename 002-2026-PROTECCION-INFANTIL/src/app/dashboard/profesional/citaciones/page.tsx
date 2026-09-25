import { redirect } from "next/navigation";

/**
 * SPEC-732 · «Citaciones» se unificó en «Calendario»: una sola pantalla donde el
 * profesional publica franjas Y responde solicitudes (el aviso «Esperando su
 * respuesta» lidera cuando hay pendientes). Esta ruta vieja REDIRIGE — no 404
 * (misma disciplina que SPEC-723): un enlace o favorito guardado cae en la única
 * pantalla.
 *
 * Stub de redirect PURO — no rinde cascarón, así que no lleva compuerta de estado
 * (mismo criterio que SPEC-711 · mecanismo 4 de SPEC-571). El destino
 * (/dashboard/profesional/calendario) sí gatea por habilitación y módulo.
 */
export default function CitacionesRedirectPage() {
    redirect("/dashboard/profesional/calendario");
}

/**
 * SPEC-940 · FORMA 169bd6fc §(d): bloque «Datos del profesional» en el panel del padre. Se renderiza SOLO cuando el
 * DTO trae el contacto (`cita.contactoProfesional`), lo que ocurre tras CONSUMIR la 1.ª cita con ese profesional y
 * con su perfil vigente (el gate `debeExponerContacto` lo decide; si venció/está suspendido, no llega → no se pinta).
 * Dirección ÚNICA: el profesional NO ve los datos del padre. Bloque neutro (tinta), voz tú.
 */
import type { ContactoProfesionalDto } from "@/lib/profesional/cita/dto";

export function DatosProfesionalCita({
    contacto,
    nombreVisible,
}: {
    contacto: ContactoProfesionalDto;
    nombreVisible: string;
}) {
    return (
        <div className="mt-4 rounded-xl border border-tinta/15 p-4" data-testid="datos-del-profesional">
            <p className="etiqueta text-subtle">Datos del profesional</p>
            <p className="cuerpo text-body">Correo: {contacto.email}</p>
            {contacto.telefono && <p className="cuerpo text-body">Teléfono: {contacto.telefono}</p>}
            <p className="mt-2 text-sm text-muted">
                Ya tuviste tu primera cita, así que ahora tienes los datos de {nombreVisible}. De la segunda en
                adelante la coordinas directamente con el profesional: Protección Infantil acompañó y cobró solo la
                primera.
            </p>
        </div>
    );
}

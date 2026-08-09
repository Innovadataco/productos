import { Badge } from "@/components/ui/Badge";

/**
 * SPEC-147 (US2, FR-003) — El contacto del acudiente junto al estudiante:
 * nombre y relación con `tel:`/`mailto:` CLICABLES (render condicional: solo si
 * el dato existe; tap target ≥ 48px). Sin teléfono NI email en los (0..2)
 * acudientes → badge ÁMBAR "sin contactos" (nunca rojo — paleta §4.2).
 * El segundo acudiente se ve en una segunda línea. Nombres largos truncan con
 * ellipsis y `title` completo. PII de tercero: jamás en audit/logs (D1 de
 * SPEC-144) — este componente solo renderiza lo que ya vino del include.
 */

export interface AcudienteVista {
    nombre: string;
    relacion: string;
    telefono: string | null;
    email: string | null;
}

function nombreConRelacion(acudiente: AcudienteVista): string {
    return `${acudiente.nombre} (${acudiente.relacion})`;
}

function EnlacesContacto({ acudiente }: { acudiente: AcudienteVista }) {
    return (
        <span className="inline-flex flex-wrap items-center gap-x-1">
            {acudiente.telefono ? (
                <a
                    href={`tel:${acudiente.telefono}`}
                    aria-label={`Llamar a ${acudiente.nombre}`}
                    className="inline-flex min-h-12 items-center rounded-lg px-2 text-sm font-semibold text-accent transition hover:underline"
                >
                    {acudiente.telefono}
                </a>
            ) : null}
            {acudiente.email ? (
                <a
                    href={`mailto:${acudiente.email}`}
                    aria-label={`Escribir a ${acudiente.nombre}`}
                    className="inline-flex min-h-12 max-w-56 items-center truncate rounded-lg px-2 text-sm font-semibold text-accent transition hover:underline"
                    title={acudiente.email}
                >
                    {acudiente.email}
                </a>
            ) : null}
        </span>
    );
}

export function AcudienteContacto({ acudientes }: { acudientes: AcudienteVista[] }) {
    const hayContacto = acudientes.some((a) => a.telefono || a.email);
    if (acudientes.length === 0 || !hayContacto) {
        return <Badge variant="warning">sin contactos</Badge>;
    }

    const [principal, ...secundarios] = acudientes;

    return (
        <span className="block">
            <span className="flex flex-wrap items-center gap-x-1">
                <span
                    className="max-w-56 truncate text-sm font-medium text-body"
                    title={nombreConRelacion(principal!)}
                >
                    {nombreConRelacion(principal!)}
                </span>
                <EnlacesContacto acudiente={principal!} />
            </span>
            {secundarios.map((acudiente, indice) => (
                <span key={indice} className="mt-0.5 flex flex-wrap items-center gap-x-1">
                    <span
                        className="max-w-56 truncate text-xs text-subtle"
                        title={nombreConRelacion(acudiente)}
                    >
                        {nombreConRelacion(acudiente)}
                    </span>
                    <EnlacesContacto acudiente={acudiente} />
                </span>
            ))}
        </span>
    );
}

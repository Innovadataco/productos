"use client";

/**
 * SPEC-954 — Control REUSABLE del año de nacimiento de un adulto (profesor/rector).
 *
 * Reemplaza al `<input type="number">` libre de las formas de alta del colegio:
 * una LISTA sólo ofrece años dentro de [ahora−80, ahora−18] (18–80 años), así que
 * un año inválido es ESTRUCTURALMENTE imposible, no sólo validado al enviar.
 *
 * Reusa el mismo `<Select>` que esas formas ya usan para «Tipo de documento» y
 * «Sexo» — no es un patrón visual nuevo. Las opciones salen de la fuente única
 * `aniosNacimientoAdulto()`; el schema del servidor sigue siendo la red de seguridad.
 *
 * Hermano del selector de MENOR del padre (`FormularioAltaHijo`, SPEC-361/565):
 * misma decisión (elegir, no teclear), distinto rango (adulto vs menor).
 */

import { Select } from "@/components/ui/Select";
import { aniosNacimientoAdulto } from "@/lib/identidad/anio-nacimiento";

type Props = {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    id?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
};

export function SelectorAnioNacimiento({
    value,
    onChange,
    label = "Año de nacimiento",
    id,
    disabled,
    required,
    error,
}: Props) {
    const opciones = [
        { value: "", label: "Elija…" },
        ...aniosNacimientoAdulto().map((anio) => ({ value: String(anio), label: String(anio) })),
    ];

    return (
        <Select
            label={label}
            options={opciones}
            value={value}
            disabled={disabled}
            required={required}
            // SPEC-954: `Select` reparte `{...props}` DESPUÉS de su `id` generado, así
            // que reenviar `id`/`error` en `undefined` los pisaría (rompe el htmlFor).
            // Sólo se pasan cuando existen.
            {...(id !== undefined ? { id } : {})}
            {...(error !== undefined ? { error } : {})}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { DOCUMENTO_TIPO_OPCIONES } from "./tipos";

/**
 * SPEC-320 (§2.3): las opciones de tipo de documento vienen del catálogo único
 * (para que un tipo que el admin agregue aparezca también acá). Fallback al set
 * hardcode si la lectura falla, para no romper el formulario.
 *
 * SPEC-910: extraído de TablaEstudiantes para reusarlo en el modal de alta por curso
 * (FormAgregarEstudiante) — una sola fuente del select de tipo de documento, sin duplicar.
 */
export function useTipoDocumentoOpciones() {
    const [tipos, setTipos] = useState<{ clave: string; nombre: string }[] | null>(null);
    useEffect(() => {
        let activo = true;
        fetch("/api/colegio/tipos-documento", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .then((d) => {
                if (activo && Array.isArray(d.items) && d.items.length > 0) setTipos(d.items);
            })
            .catch(() => {
                /* fallback al hardcode */
            });
        return () => {
            activo = false;
        };
    }, []);
    return useMemo(() => {
        // SPEC-320 (§2.2-bis): el documento del alumno es obligatorio; el placeholder ya
        // no ofrece "Sin documento".
        if (!tipos) return [{ value: "", label: "Seleccione tipo… *" }, ...DOCUMENTO_TIPO_OPCIONES.filter((o) => o.value !== "")];
        return [{ value: "", label: "Seleccione tipo… *" }, ...tipos.map((t) => ({ value: t.clave, label: t.nombre }))];
    }, [tipos]);
}

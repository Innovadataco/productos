"use client";

import { useEffect, useId, useRef, useState } from "react";

export type CiudadOpcion = {
    id: string;
    nombre: string;
    paisId: string;
    departamentoId: string | null;
    departamento: string | null;
};

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

/**
 * SPEC-115: selector de ciudad con búsqueda en el SERVIDOR (debounce 300 ms,
 * máx 20 resultados vía GET /api/ciudades/buscar). Reemplaza al <select> que
 * cargaba el catálogo completo al navegador. `permitirOtra` añade la opción
 * "Otra ciudad o municipio" (flujo del wizard de reporte: el texto libre se
 * conserva como antes). La atribución GeoNames (CC-BY 4.0) va en el pie del
 * desplegable. Ante error o 429 el buscador degrada a un mensaje no bloqueante.
 */
export function CiudadSearchSelect({
    label = "Ciudad",
    paisId,
    departamentoId,
    value,
    onSelect,
    disabled,
    permitirOtra = false,
    placeholder = "Escribe el nombre de la ciudad o municipio",
}: {
    label?: string;
    paisId: string;
    departamentoId?: string | undefined;
    /** Opción actualmente seleccionada (null = ninguna). */
    value: CiudadOpcion | null;
    onSelect: (opcion: CiudadOpcion | null) => void;
    disabled?: boolean;
    permitirOtra?: boolean;
    placeholder?: string;
}) {
    const id = useId();
    const [texto, setTexto] = useState(value?.nombre ?? "");
    const [resultados, setResultados] = useState<CiudadOpcion[]>([]);
    const [abierto, setAbierto] = useState(false);
    const [buscando, setBuscando] = useState(false);
    const [fallo, setFallo] = useState(false);
    const contenedorRef = useRef<HTMLDivElement>(null);

    // Si el padre cambia la selección (reset de formulario), reflejarla en el input
    useEffect(() => {
        setTexto(value?.nombre ?? "");
    }, [value]);

    // Al cambiar país/departamento se invalidan los resultados anteriores
    useEffect(() => {
        setResultados([]);
        setAbierto(false);
    }, [paisId, departamentoId]);

    // Cerrar el desplegable al hacer clic fuera
    useEffect(() => {
        function onClickFuera(e: MouseEvent) {
            if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
                setAbierto(false);
            }
        }
        document.addEventListener("mousedown", onClickFuera);
        return () => document.removeEventListener("mousedown", onClickFuera);
    }, []);

    // Búsqueda con debounce
    useEffect(() => {
        if (!paisId || disabled) return;
        const consulta = texto.trim();
        if (value && consulta === value.nombre) return; // texto = selección vigente
        if (consulta.length < MIN_CHARS) {
            setResultados([]);
            setAbierto(false);
            return;
        }
        setBuscando(true);
        setFallo(false);
        const timer = setTimeout(() => {
            const params = new URLSearchParams({ q: consulta, paisId, limit: "20" });
            if (departamentoId) params.set("departamentoId", departamentoId);
            fetch(`/api/ciudades/buscar?${params.toString()}`, { credentials: "include" })
                .then(async (r) => {
                    if (!r.ok) throw new Error(String(r.status));
                    return r.json();
                })
                .then((json) => {
                    setResultados(json.ciudades || []);
                    setAbierto(true);
                })
                .catch(() => {
                    setResultados([]);
                    setFallo(true);
                    setAbierto(true);
                })
                .finally(() => setBuscando(false));
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [texto, paisId, departamentoId, disabled, value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setTexto(e.target.value);
        if (value) onSelect(null); // editar el texto invalida la selección previa
    }

    function elegir(opcion: CiudadOpcion) {
        onSelect(opcion);
        setTexto(opcion.nombre);
        setAbierto(false);
    }

    return (
        <div ref={contenedorRef} className="relative w-full">
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-body">
                {label}
            </label>
            <input
                id={id}
                role="combobox"
                aria-expanded={abierto}
                aria-controls={`${id}-lista`}
                aria-autocomplete="list"
                className="w-full rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input ring-accent-input"
                value={texto}
                onChange={handleChange}
                onFocus={() => resultados.length > 0 && setAbierto(true)}
                placeholder={placeholder}
                disabled={disabled || !paisId}
                autoComplete="off"
            />
            {buscando && <p className="mt-1 text-xs text-muted">Buscando…</p>}

            {abierto && (
                <div
                    id={`${id}-lista`}
                    role="listbox"
                    aria-label="Resultados de ciudades"
                    className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-tinta/10 bg-papel shadow-lg"
                >
                    {fallo ? (
                        <p className="px-4 py-3 text-sm text-muted">
                            No se pudo buscar ahora. Intenta de nuevo en unos segundos.
                        </p>
                    ) : resultados.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-muted">
                            Sin resultados{permitirOtra ? " — puedes usar «Otra ciudad o municipio»" : ""}.
                        </p>
                    ) : (
                        resultados.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                role="option"
                                aria-selected={value?.id === c.id}
                                className="block w-full px-4 py-2.5 text-left text-sm text-body hover:bg-tinta/5"
                                onClick={() => elegir(c)}
                            >
                                <span className="font-medium">{c.nombre}</span>
                                {c.departamento && <span className="text-muted">, {c.departamento}</span>}
                            </button>
                        ))
                    )}
                    {permitirOtra && !fallo && (
                        <button
                            type="button"
                            role="option"
                            aria-selected={value?.id === "otra"}
                            className="block w-full border-t border-tinta/10 px-4 py-2.5 text-left text-sm font-medium text-accent hover:bg-tinta/5"
                            onClick={() => elegir({ id: "otra", nombre: "", paisId, departamentoId: null, departamento: null })}
                        >
                            Otra ciudad o municipio
                        </button>
                    )}
                    <p className="border-t border-tinta/10 px-4 py-1.5 text-[10px] text-subtle">
                        Datos geográficos: GeoNames (CC-BY 4.0)
                    </p>
                </div>
            )}
        </div>
    );
}

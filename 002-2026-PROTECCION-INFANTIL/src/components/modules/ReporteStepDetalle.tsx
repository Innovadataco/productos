"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { useMinTextoReporte } from "./use-min-texto-reporte";

type PaisOption = { id: string; nombre: string };

export function ReporteStepDetalle({
    ciudad,
    pais,
    fechaIncidente,
    paisId,
    ciudadId,
    edadVictima,
    texto,
    onChange,
}: {
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    paisId: string;
    ciudadId: string;
    edadVictima: string;
    texto: string;
    onChange: (v: {
        ciudad: string;
        pais: string;
        fechaIncidente: string;
        paisId: string;
        ciudadId: string;
        edadVictima: string;
        texto: string;
    }) => void;
}) {
    const [paises, setPaises] = useState<PaisOption[]>([]);
    const [otraCiudad, setOtraCiudad] = useState(ciudadId === "otra" ? ciudad : "");
    const hoy = new Date().toISOString().split("T")[0];

    useEffect(() => {
        fetch("/api/paises", { credentials: "include" })
            .then((r) => r.json())
            .then((json) => setPaises(json.paises || []))
            .catch(() => setPaises([]));
    }, []);

    const esOtraCiudad = ciudadId === "otra";

    const handlePaisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedNombre = paises.find((p) => p.id === selectedId)?.nombre || "";
        onChange({
            paisId: selectedId,
            pais: selectedNombre,
            ciudad: "",
            ciudadId: "",
            fechaIncidente,
            edadVictima,
            texto,
        });
        setOtraCiudad("");
    };

    // SPEC-115: la ciudad se elige con buscador en servidor (el catálogo ya no cabe
    // en un <select>). "Otra ciudad o municipio" conserva el texto libre como antes:
    // el dato nunca se pierde aunque la ciudad no tenga coordenadas.
    const ciudadSeleccionada: CiudadOpcion | null =
        ciudadId && ciudadId !== "otra"
            ? { id: ciudadId, nombre: ciudad, paisId, departamentoId: null, departamento: null }
            : null;

    const handleCiudadSelect = (opcion: CiudadOpcion | null) => {
        if (!opcion) {
            onChange({ ciudadId: "", ciudad: "", pais, paisId, fechaIncidente, edadVictima, texto });
            return;
        }
        if (opcion.id === "otra") {
            onChange({
                ciudadId: "otra",
                ciudad: otraCiudad || "",
                pais,
                paisId,
                fechaIncidente,
                edadVictima,
                texto,
            });
        } else {
            onChange({
                ciudadId: opcion.id,
                ciudad: opcion.nombre,
                pais,
                paisId,
                fechaIncidente,
                edadVictima,
                texto,
            });
            setOtraCiudad("");
        }
    };

    const handleOtraCiudadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setOtraCiudad(val);
        if (esOtraCiudad) {
            onChange({
                ciudadId: "otra",
                ciudad: val,
                pais,
                paisId,
                fechaIncidente,
                edadVictima,
                texto,
            });
        }
    };

    const chars = texto.length;
    const min = useMinTextoReporte();
    const max = 5000;
    const isValid = chars >= min && chars <= max;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-body">Detalles del incidente</h2>

            <p className="text-sm text-muted">
                Comparte la información que recuerdes. No hay datos obligatorios más allá de país, ciudad y descripción.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                    label="País"
                    options={[
                        { value: "", label: "Selecciona un país" },
                        ...paises.map((p) => ({ value: p.id, label: p.nombre })),
                    ]}
                    value={paisId}
                    onChange={handlePaisChange}
                />

                <CiudadSearchSelect
                    paisId={paisId}
                    value={ciudadSeleccionada}
                    onSelect={handleCiudadSelect}
                    disabled={!paisId}
                    permitirOtra
                />

                <Input
                    label="Fecha del incidente"
                    type="date"
                    max={hoy}
                    value={fechaIncidente}
                    onChange={(e) =>
                        onChange({ ciudad, pais, fechaIncidente: e.target.value, paisId, ciudadId, edadVictima, texto })
                    }
                />

                <Input
                    label="Edad aproximada del menor (opcional)"
                    type="number"
                    min={1}
                    max={120}
                    placeholder="Ej: 12"
                    value={edadVictima}
                    onChange={(e) =>
                        onChange({ ciudad, pais, fechaIncidente, paisId, ciudadId, edadVictima: e.target.value, texto })
                    }
                />
            </div>

            {esOtraCiudad && (
                <Input
                    label="Escribe la ciudad o municipio"
                    placeholder="Ej: San Andrés"
                    value={otraCiudad}
                    onChange={handleOtraCiudadChange}
                />
            )}

            <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                    Describe lo que ocurrió
                </label>
                <textarea
                    className="w-full rounded-xl px-4 py-3 text-sm text-body placeholder-subtle outline-none transition min-h-[160px] resize-y glass-input ring-accent-input"
                    placeholder="Describe la conducta observada con el mayor detalle posible..."
                    value={texto}
                    onChange={(e) => onChange({ ciudad, pais, fechaIncidente, paisId, ciudadId, edadVictima, texto: e.target.value })}
                    maxLength={max}
                />
                <div className="mt-1.5 flex justify-between text-xs">
                    <span className={isValid ? "text-subtle" : "text-red-600 dark:text-red-400"}>
                        {chars < min
                            ? `Mínimo ${min} caracteres (${chars}/${min})`
                            : chars > max
                                ? `Máximo ${max} caracteres`
                                : `${chars}/${max}`}
                    </span>
                </div>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                Este reporte es solo de texto. No incluyas fotos, videos ni archivos adjuntos.
            </div>
        </div>
    );
}

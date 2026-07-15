"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type PaisOption = { id: string; nombre: string };
type CiudadOption = { id: string; nombre: string; paisId: string };

export function ReporteStepUbicacion({
    ciudad,
    pais,
    fechaIncidente,
    paisId,
    ciudadId,
    onChange,
}: {
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    paisId: string;
    ciudadId: string;
    onChange: (v: {
        ciudad: string;
        pais: string;
        fechaIncidente: string;
        paisId: string;
        ciudadId: string;
    }) => void;
}) {
    const [paises, setPaises] = useState<PaisOption[]>([]);
    const [ciudades, setCiudades] = useState<CiudadOption[]>([]);
    const [otraCiudad, setOtraCiudad] = useState("");
    const hoy = new Date().toISOString().split("T")[0];

    // Cargar países al montar
    useEffect(() => {
        fetch("/api/paises", { credentials: "include" })
            .then((r) => r.json())
            .then((json) => setPaises(json.paises || []))
            .catch(() => setPaises([]));
    }, []);

    // Cargar ciudades cuando cambia país seleccionado
    useEffect(() => {
        if (!paisId) return;
        fetch(`/api/ciudades?paisId=${encodeURIComponent(paisId)}`, {
            credentials: "include",
        })
            .then((r) => r.json())
            .then((json) => setCiudades(json.ciudades || []))
            .catch(() => setCiudades([]));
    }, [paisId]);

    const esOtraCiudad = ciudadId === "otra";

    const handlePaisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedNombre =
            paises.find((p) => p.id === selectedId)?.nombre || "";
        if (!selectedId) {
            setCiudades([]);
        }
        onChange({
            paisId: selectedId,
            pais: selectedNombre,
            ciudad: "",
            ciudadId: "",
            fechaIncidente,
        });
        setOtraCiudad("");
    };

    const handleCiudadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        if (selectedId === "otra") {
            onChange({
                ciudadId: "otra",
                ciudad: otraCiudad || "",
                pais,
                paisId,
                fechaIncidente,
            });
        } else {
            const selectedNombre =
                ciudades.find((c) => c.id === selectedId)?.nombre || "";
            onChange({
                ciudadId: selectedId,
                ciudad: selectedNombre,
                pais,
                paisId,
                fechaIncidente,
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
            });
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">¿Dónde y cuándo ocurrió?</h2>

            <Select
                label="País"
                options={[
                    { value: "", label: "Selecciona un país" },
                    ...paises.map((p) => ({ value: p.id, label: p.nombre })),
                ]}
                value={paisId}
                onChange={handlePaisChange}
            />

            <Select
                label="Ciudad"
                options={[
                    { value: "", label: "Selecciona una ciudad" },
                    ...ciudades.map((c) => ({ value: c.id, label: c.nombre })),
                ]}
                value={ciudadId}
                onChange={handleCiudadChange}
                disabled={!paisId}
            />

            {esOtraCiudad && (
                <Input
                    label="Escribe la ciudad o municipio"
                    placeholder="Ej: San Andrés"
                    value={otraCiudad}
                    onChange={handleOtraCiudadChange}
                />
            )}

            <Input
                label="Fecha del incidente"
                type="date"
                max={hoy}
                value={fechaIncidente}
                onChange={(e) =>
                    onChange({ ciudad, pais, fechaIncidente: e.target.value, paisId, ciudadId })
                }
            />
        </div>
    );
}
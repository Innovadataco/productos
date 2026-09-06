"use client";

import { useState, useEffect } from "react";
import { edadesReporte } from "@/lib/padre/documento-menor";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { useMinTextoReporte } from "./use-min-texto-reporte";
import { FechaHoraIncidente } from "./FechaHoraIncidente";

type PaisOption = { id: string; nombre: string };

export function ReporteStepDetalle({
    ciudad,
    pais,
    fechaIncidente,
    horaAproximada,
    paisId,
    ciudadId,
    edadVictima,
    texto,
    onChange,
}: {
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    /** SPEC-438: la hora la estimó el reportante (eligió franja). */
    horaAproximada: boolean;
    paisId: string;
    ciudadId: string;
    edadVictima: string;
    texto: string;
    onChange: (v: {
        ciudad: string;
        pais: string;
        fechaIncidente: string;
        horaAproximada: boolean;
        paisId: string;
        ciudadId: string;
        edadVictima: string;
        texto: string;
    }) => void;
}) {
    const [paises, setPaises] = useState<PaisOption[]>([]);
    const [otraCiudad, setOtraCiudad] = useState(ciudadId === "otra" ? ciudad : "");
    // SPEC-340 §2 (T017): día Y hora del incidente. Formato datetime-local (YYYY-MM-DDTHH:mm).
    //
    // A-70 · B1 (causa raíz): esto era `toISOString().slice(0,16)` — hora UTC —
    // mientras el input `datetime-local` opera en hora LOCAL del navegador. En
    // Colombia (UTC−5) el desfase dejaba elegir hasta 5 horas en el FUTURO real
    // sin que el input se quejara; el servidor lo rechazaba con 400 "Datos
    // inválidos" y el padre perdía el relato. El `max` tiene que estar en la
    // MISMA zona que el input: la local.
    const hoy = (() => {
        const ahora = new Date();
        const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
        return local.toISOString().slice(0, 16);
    })();
    // SPEC-563 (Jelkin): piso de 2 años atrás, en la MISMA zona local que el input.
    // Es comodidad del navegador; la barrera de verdad la aplica el servidor
    // (fechaIncidenteSchema). Mismo cálculo local que `hoy`.
    const hace2Anios = (() => {
        const ahora = new Date();
        ahora.setFullYear(ahora.getFullYear() - 2);
        const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
        return local.toISOString().slice(0, 16);
    })();

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
            horaAproximada,
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
            onChange({ ciudadId: "", ciudad: "", pais, paisId, fechaIncidente, horaAproximada, edadVictima, texto });
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
                horaAproximada,
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
                horaAproximada,
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
                horaAproximada,
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

                {/* A-74 · P1: el `datetime-local` nativo pintaba el segmento de
                    minutos aun con step=3600 ("02/09/2026, 02:00 p.m.") y vacío se
                    veía "dd/mm/aaaa, --:-- ----". Se reemplaza por el control de
                    día + hora 1-12 + a.m./p.m. Conserva los candados de B1: el tope
                    va en hora LOCAL, es imposible elegir futuro (las horas de hoy
                    que no han pasado quedan deshabilitadas) y siempre sale la hora
                    en punto, así que el borrador del wizard no cambia. */}
                <FechaHoraIncidente
                    value={fechaIncidente}
                    max={hoy}
                    min={hace2Anios}
                    onChange={(elegido, aproximada) =>
                        // Una sola emisión: la fecha y su marca viajan juntas.
                        // Elegir hora EXACTA (sin marca) apaga la aproximación.
                        onChange({
                            ciudad,
                            pais,
                            fechaIncidente: elegido,
                            horaAproximada: aproximada === true,
                            paisId,
                            ciudadId,
                            edadVictima,
                            texto,
                        })
                    }
                    error={fechaIncidente > hoy ? "El hecho no puede ser a futuro; ajustamos la hora al momento actual." : undefined}
                />

                {/* SPEC-361 (A-70 · F9): la edad se ELIGE de una lista de 4 a 17,
                    el rango del producto. Antes era un campo libre de 1 a 120,
                    donde cabía cualquier número que no describe a un menor. */}
                <Select
                    label="Edad aproximada del menor (opcional)"
                    options={[
                        { value: "", label: "Sin especificar" },
                        ...edadesReporte().map((e) => ({ value: String(e), label: `${e} años` })),
                    ]}
                    value={edadVictima}
                    onChange={(e) =>
                        onChange({ ciudad, pais, fechaIncidente, paisId, ciudadId, edadVictima: e.target.value, texto , horaAproximada })
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
                    onChange={(e) => onChange({ ciudad, pais, fechaIncidente, paisId, ciudadId, edadVictima, texto: e.target.value , horaAproximada })}
                    maxLength={max}
                />
                <div className="mt-1.5 flex justify-between text-xs">
                    <span className={isValid ? "text-subtle" : "text-estado-rubi"}>
                        {chars < min
                            ? `Mínimo ${min} caracteres (${chars}/${min})`
                            : chars > max
                                ? `Máximo ${max} caracteres`
                                : `${chars}/${max}`}
                    </span>
                </div>
            </div>

            <div className="rounded-xl bg-ambar/10 p-3 text-xs text-estado-ambar">
                Este reporte es solo de texto. No incluyas fotos, videos ni archivos adjuntos.
            </div>
        </div>
    );
}

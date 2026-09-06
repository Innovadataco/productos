"use client";

import { useFetchJson } from "@/components/ui/use-fetch-json";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ETIQUETAS_RELACION, identificadorVacio, type EstudianteForm, type IdentificadorForm } from "./tipos";

/**
 * SPEC-146 (T005) — Sección 3 del wizard: identificadores digitales por
 * estudiante (redes, gamer tags). OPCIONAL: colapsada por defecto; el tipo se
 * puede dejar vacío y el servidor lo infiere del valor. Plataformas desde
 * GET /api/plataformas (catálogo público).
 */

interface Plataforma {
    id: string;
    clave: string;
    nombre: string;
}

interface SeccionIdentificadoresProps {
    estudiantes: EstudianteForm[];
    onChange: (estudiantes: EstudianteForm[]) => void;
}

const TIPO_OPCIONES = [
    { value: "", label: "Se detecta solo" },
    { value: "telefono", label: "Teléfono" },
    { value: "email", label: "Email" },
    { value: "nick", label: "Nick / gamer tag" },
];

export function SeccionIdentificadores({ estudiantes, onChange }: SeccionIdentificadoresProps) {
    const { datos } = useFetchJson<{ plataformas: Plataforma[] }>("/api/plataformas");
    const plataformas = datos?.plataformas ?? [];

    function actualizarIdentificadores(key: string, identificadores: IdentificadorForm[]) {
        onChange(estudiantes.map((e) => (e.key === key ? { ...e, identificadores } : e)));
    }

    const conNombre = estudiantes.filter((e) => e.nombre.trim() || e.apellidos.trim());

    if (conNombre.length === 0) {
        return (
            <p className="text-sm text-muted">
                Agrega estudiantes en la sección 2 y aquí podrás registrar sus identificadores digitales. Es opcional:
                lo puede hacer después.
            </p>
        );
    }

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted">
                Redes, gamer tags, teléfonos o emails con los que sus estudiantes aparecen en línea. Es opcional.
            </p>
            {conNombre.map((estudiante, indice) => (
                <div key={estudiante.key} className="glass-input space-y-3 rounded-2xl p-4" aria-label={`Identificadores de ${estudiante.nombre} ${estudiante.apellidos}`}>
                    <p className="text-sm font-semibold text-body">
                        {estudiante.nombre} {estudiante.apellidos}
                    </p>
                    {estudiante.identificadores.map((identificador, indiceId) => (
                        <div key={indiceId} className="space-y-2 rounded-xl bg-tinta/5 p-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Select
                                    aria-label={`Tipo del identificador ${indiceId + 1} del estudiante ${indice + 1}`}
                                    options={TIPO_OPCIONES}
                                    value={identificador.tipo}
                                    onChange={(e) =>
                                        actualizarIdentificadores(
                                            estudiante.key,
                                            estudiante.identificadores.map((id, i) => (i === indiceId ? { ...id, tipo: e.target.value } : id))
                                        )
                                    }
                                />
                                <Input
                                    aria-label={`Valor del identificador ${indiceId + 1} del estudiante ${indice + 1}`}
                                    placeholder="Valor (ej. @nick, +57…, email)"
                                    maxLength={255}
                                    value={identificador.valor}
                                    onChange={(e) =>
                                        actualizarIdentificadores(
                                            estudiante.key,
                                            estudiante.identificadores.map((id, i) => (i === indiceId ? { ...id, valor: e.target.value } : id))
                                        )
                                    }
                                />
                                <Select
                                    aria-label={`Plataforma del identificador ${indiceId + 1} del estudiante ${indice + 1}`}
                                    options={[
                                        { value: "", label: "Sin plataforma" },
                                        ...plataformas.map((p) => ({ value: p.id, label: p.nombre })),
                                    ]}
                                    value={identificador.plataformaId}
                                    onChange={(e) =>
                                        actualizarIdentificadores(
                                            estudiante.key,
                                            estudiante.identificadores.map((id, i) => (i === indiceId ? { ...id, plataformaId: e.target.value } : id))
                                        )
                                    }
                                />
                                <Select
                                    aria-label={`Relación del identificador ${indiceId + 1} del estudiante ${indice + 1}`}
                                    options={ETIQUETAS_RELACION.map((etiqueta) => ({
                                        value: etiqueta,
                                        label: etiqueta === "ESTUDIANTE" ? "Del estudiante" : etiqueta.charAt(0) + etiqueta.slice(1).toLowerCase(),
                                    }))}
                                    value={identificador.etiquetaRelacion}
                                    onChange={(e) =>
                                        actualizarIdentificadores(
                                            estudiante.key,
                                            estudiante.identificadores.map((id, i) => (i === indiceId ? { ...id, etiquetaRelacion: e.target.value } : id))
                                        )
                                    }
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                className="min-h-12"
                                aria-label={`Quitar identificador ${indiceId + 1} del estudiante ${indice + 1}`}
                                onClick={() =>
                                    actualizarIdentificadores(
                                        estudiante.key,
                                        estudiante.identificadores.filter((_, i) => i !== indiceId)
                                    )
                                }
                            >
                                Quitar identificador
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="ghost"
                        className="min-h-12"
                        onClick={() => actualizarIdentificadores(estudiante.key, [...estudiante.identificadores, identificadorVacio()])}
                    >
                        + Agregar identificador
                    </Button>
                </div>
            ))}
        </div>
    );
}

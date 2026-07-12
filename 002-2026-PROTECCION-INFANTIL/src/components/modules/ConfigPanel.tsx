"use client";

import { useState, useEffect } from "react";

type Param = {
    id: string;
    clave: string;
    valor: string;
    tipo: string;
    categoria: string;
    esPublico: boolean;
    esSecreto: boolean;
    descripcion: string | null;
};

export default function ConfigPanel() {
    const [params, setParams] = useState<Param[]>([]);
    const [loading, setLoading] = useState(true);
    const [editValue, setEditValue] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch("/api/config/parametros")
            .then((r) => r.json())
            .then((data) => {
                setParams(data.items || []);
                setLoading(false);
            });
    }, []);

    async function updateParam(clave: string) {
        const valor = editValue[clave];
        if (!valor) return;
        const res = await fetch(`/api/config/parametros/${clave}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valor }),
        });
        if (res.ok) {
            setParams((prev) =>
                prev.map((p) => (p.clave === clave ? { ...p, valor } : p))
            );
            setEditValue((prev) => ({ ...prev, [clave]: "" }));
        }
    }

    if (loading) return <p>Cargando...</p>;

    return (
        <div>
            <h2>Parámetros del Sistema</h2>
            <table>
                <thead>
                    <tr>
                        <th>Clave</th>
                        <th>Valor</th>
                        <th>Tipo</th>
                        <th>Categoría</th>
                        <th>Público</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {params.map((p) => (
                        <tr key={p.id}>
                            <td>{p.clave}</td>
                            <td>
                                {p.esSecreto
                                    ? "••••••"
                                    : p.valor}
                            </td>
                            <td>{p.tipo}</td>
                            <td>{p.categoria}</td>
                            <td>{p.esPublico ? "Sí" : "No"}</td>
                            <td>
                                <input
                                    type="text"
                                    value={editValue[p.clave] || ""}
                                    onChange={(e) =>
                                        setEditValue((prev) => ({
                                            ...prev,
                                            [p.clave]: e.target.value,
                                        }))
                                    }
                                    placeholder="Nuevo valor"
                                />
                                <button onClick={() => updateParam(p.clave)}>Guardar</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
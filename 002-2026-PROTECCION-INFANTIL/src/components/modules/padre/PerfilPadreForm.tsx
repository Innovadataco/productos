"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { Cargando } from "@/components/ui/Cargando";

type PaisOption = { id: string; nombre: string };

type Perfil = {
    nombre: string | null;
    apellidos: string | null;
    fechaNacimiento: string | null;
    telefono: string | null;
    paisId: string | null;
    ciudadId: string | null;
    paisPerfil: { id: string; nombre: string } | null;
    ciudadPerfil: { id: string; nombre: string } | null;
};

// SPEC-334: perfil del padre — ver y editar los 6 datos. País/ciudad del catálogo
// existente (sin "Otra ciudad"); fecha con selector de fecha; teléfono validado.
export function PerfilPadreForm() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [paises, setPaises] = useState<PaisOption[]>([]);

    const [nombre, setNombre] = useState("");
    const [apellidos, setApellidos] = useState("");
    const [fechaNacimiento, setFechaNacimiento] = useState("");
    const [telefono, setTelefono] = useState("");
    const [paisId, setPaisId] = useState("");
    const [ciudad, setCiudad] = useState<CiudadOpcion | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const [pRes, paisRes] = await Promise.all([
                    fetch("/api/padre/perfil", { credentials: "include" }),
                    fetch("/api/paises", { credentials: "include" }),
                ]);
                const paisJson = await paisRes.json();
                setPaises(paisJson.paises || []);
                if (pRes.ok) {
                    const { perfil } = (await pRes.json()) as { perfil: Perfil };
                    setNombre(perfil.nombre ?? "");
                    setApellidos(perfil.apellidos ?? "");
                    setFechaNacimiento(perfil.fechaNacimiento ? perfil.fechaNacimiento.slice(0, 10) : "");
                    setTelefono(perfil.telefono ?? "");
                    setPaisId(perfil.paisId ?? "");
                    if (perfil.ciudadId && perfil.ciudadPerfil) {
                        setCiudad({ id: perfil.ciudadId, nombre: perfil.ciudadPerfil.nombre, paisId: perfil.paisId ?? "", departamentoId: null, departamento: null });
                    }
                }
            } catch {
                setError("No pudimos cargar tu perfil.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    async function guardar(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setOk(false);
        try {
            const res = await fetch("/api/padre/perfil", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    nombre: nombre.trim() || undefined,
                    apellidos: apellidos.trim() || undefined,
                    fechaNacimiento: fechaNacimiento || null,
                    telefono: telefono.trim() || null,
                    paisId: paisId || null,
                    ciudadId: ciudad?.id || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "No pudimos guardar tu perfil.");
                return;
            }
            setOk(true);
        } catch {
            setError("Error de red al guardar.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="glass rounded-2xl p-8 text-center"><Cargando texto="Cargando tu perfil…" /></div>;

    return (
        <form onSubmit={guardar} className="glass space-y-4 rounded-2xl p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Nombres" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tus nombres" />
                <Input label="Apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Tus apellidos" />
                <Input label="Fecha de nacimiento" type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
                <Input label="Teléfono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej. +57 300 123 4567" />
                <Select
                    label="País"
                    options={[{ value: "", label: "Selecciona un país" }, ...paises.map((p) => ({ value: p.id, label: p.nombre }))]}
                    value={paisId}
                    onChange={(e) => {
                        setPaisId(e.target.value);
                        setCiudad(null); // país→ciudad dependiente: al cambiar país, se limpia la ciudad
                    }}
                />
                <CiudadSearchSelect paisId={paisId} value={ciudad} onSelect={setCiudad} disabled={!paisId} permitirOtra={false} />
            </div>

            {error && <p className="text-sm text-estado-rubi">{error}</p>}
            {ok && <p className="text-sm text-estado-pino">Tus datos quedaron guardados.</p>}

            <div className="flex justify-end">
                <Button type="submit" isLoading={saving}>{saving ? "Guardando…" : "Guardar mis datos"}</Button>
            </div>
        </form>
    );
}

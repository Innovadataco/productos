"use client";

// SPEC-325 (002-PI-225) · "A quién protejo" — el padre registra hijos y
// familiares cercanos con su documento e identificadores. Si alguien reporta el
// identificador de un hijo, el padre se entera (mecanismo compartido). Lenguaje
// de padre (A-62): esto NO es vigilancia, es cuidar a los tuyos.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";

const DOCUMENTO_TIPOS = [
    { value: "RC", label: "Registro civil" },
    { value: "TI", label: "Tarjeta de identidad" },
    { value: "CC", label: "Cédula" },
    { value: "CE", label: "Cédula de extranjería" },
    { value: "PASAPORTE", label: "Pasaporte" },
    { value: "OTRO", label: "Otro" },
];
const SEXOS = [
    { value: "", label: "Prefiero no decir" },
    { value: "M", label: "Masculino" },
    { value: "F", label: "Femenino" },
    { value: "OTRO", label: "Otro" },
];

type Identificador = { id: string; valor: string; tipo: string | null; plataforma: { nombre: string } | null };
type Hijo = {
    id: string;
    nombre: string;
    apellidos: string;
    documentoTipo: string;
    documentoNumero: string;
    anioNacimiento: number | null;
    sexo: string | null;
    identificadores: Identificador[];
};

export function MisHijos() {
    const [hijos, setHijos] = useState<Hijo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        nombre: "",
        apellidos: "",
        documentoTipo: "TI",
        documentoNumero: "",
        anioNacimiento: "",
        sexo: "",
        identificador: "",
    });
    const [guardando, setGuardando] = useState(false);

    async function cargar() {
        setCargando(true);
        try {
            const res = await fetch("/api/padre/hijos");
            if (!res.ok) throw new Error("No se pudo cargar");
            setHijos(await res.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
        } finally {
            setCargando(false);
        }
    }

    useEffect(() => {
        void cargar();
    }, []);

    async function registrar(e: React.FormEvent) {
        e.preventDefault();
        if (!form.nombre.trim() || !form.documentoNumero.trim()) return;
        setGuardando(true);
        setError(null);
        try {
            const body: Record<string, unknown> = {
                nombre: form.nombre.trim(),
                apellidos: form.apellidos.trim() || undefined,
                documentoTipo: form.documentoTipo,
                documentoNumero: form.documentoNumero.trim(),
                anioNacimiento: form.anioNacimiento ? Number(form.anioNacimiento) : undefined,
                sexo: form.sexo || undefined,
                identificadores: form.identificador.trim()
                    ? [{ valor: form.identificador.trim() }]
                    : undefined,
            };
            const res = await fetch("/api/padre/hijos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("No se pudo registrar");
            setForm({ nombre: "", apellidos: "", documentoTipo: "TI", documentoNumero: "", anioNacimiento: "", sexo: "", identificador: "" });
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
        } finally {
            setGuardando(false);
        }
    }

    async function desvincular(identificadorId: string) {
        try {
            const res = await fetch(`/api/padre/hijos/identificadores/${identificadorId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("No se pudo quitar");
            await cargar();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
        }
    }

    return (
        <section aria-label="A quién protejo" data-testid="mis-hijos" className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-body">A quién protejo</h2>
                <p className="text-sm text-muted">
                    Registrá a tus hijos y a los familiares cercanos. Si alguien reporta uno de sus
                    identificadores (su Roblox, un teléfono, un correo), te avisamos.
                </p>
            </header>

            <GlassCard className="p-4">
                <form onSubmit={registrar} className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="form-hijo">
                    <Input label="Nombres" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                    <Input label="Apellidos" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
                    <Select label="Tipo de documento" options={DOCUMENTO_TIPOS} value={form.documentoTipo} onChange={(e) => setForm({ ...form, documentoTipo: e.target.value })} />
                    <Input label="Número de documento" value={form.documentoNumero} onChange={(e) => setForm({ ...form, documentoNumero: e.target.value })} required />
                    <Input label="Año de nacimiento" type="number" value={form.anioNacimiento} onChange={(e) => setForm({ ...form, anioNacimiento: e.target.value })} />
                    <Select label="Sexo" options={SEXOS} value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })} />
                    <Input label="Un identificador (opcional)" placeholder="su Roblox, teléfono, correo…" value={form.identificador} onChange={(e) => setForm({ ...form, identificador: e.target.value })} />
                    <div className="flex items-end">
                        <Button type="submit" isLoading={guardando} disabled={guardando}>Registrar</Button>
                    </div>
                </form>
                {error && <p className="mt-2 text-sm text-red-600" data-testid="mis-hijos-error">{error}</p>}
            </GlassCard>

            {cargando ? (
                <p className="text-sm text-muted">Cargando…</p>
            ) : hijos.length === 0 ? (
                <p className="text-sm text-muted" data-testid="mis-hijos-vacio">Todavía no registraste a nadie.</p>
            ) : (
                <ul className="space-y-3" data-testid="lista-hijos">
                    {hijos.map((h) => (
                        <li key={h.id}>
                            <GlassCard className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-body">
                                            {h.nombre} {h.apellidos}
                                        </div>
                                        <div className="text-xs text-muted">
                                            {h.documentoTipo} {h.documentoNumero}
                                            {h.anioNacimiento ? ` · ${new Date().getFullYear() - h.anioNacimiento} años` : ""}
                                        </div>
                                    </div>
                                </div>
                                {h.identificadores.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {h.identificadores.map((i) => (
                                            <span key={i.id} className="inline-flex items-center gap-1">
                                                <Badge>{i.valor}{i.plataforma ? ` · ${i.plataforma.nombre}` : ""}</Badge>
                                                <button
                                                    type="button"
                                                    aria-label={`Quitar ${i.valor}`}
                                                    className="text-xs text-muted hover:text-red-600"
                                                    onClick={() => desvincular(i.id)}
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </GlassCard>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

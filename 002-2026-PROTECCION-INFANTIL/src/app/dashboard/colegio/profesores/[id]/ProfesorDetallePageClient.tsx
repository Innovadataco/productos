"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";

type Profesor = {
    id: string;
    nombre: string;
    apellidos: string;
    email: string | null;
    telefono: string | null;
    estado: string;
};

type Identificador = {
    id: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
    plataforma: { id: string; clave: string; nombre: string } | null;
    estado: string;
};

type Plataforma = { id: string; clave: string; nombre: string };

type Mensaje = { type: "success" | "error"; text: string } | null;

const IDENTIFICADOR_VACIO = { valor: "", plataformaId: "" };

export default function ProfesorDetallePageClient({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [profesorId, setProfesorId] = useState<string | null>(null);
    const [profesor, setProfesor] = useState<Profesor | null>(null);
    const [identificadores, setIdentificadores] = useState<Identificador[]>([]);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [errorPlataformas, setErrorPlataformas] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nuevo, setNuevo] = useState(IDENTIFICADOR_VACIO);
    const [editando, setEditando] = useState<Identificador | null>(null);

    useEffect(() => {
        params.then((p) => {
            setProfesorId(p.id);
            cargar(p.id);
        });
        void cargarPlataformas();
    }, [params]);

    // /api/plataformas responde { plataformas: [...] }; error visible con reintento (SPEC-173, H03).
    async function cargarPlataformas() {
        try {
            const res = await fetch("/api/plataformas", { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: unknown = await res.json();
            const lista = (data as { plataformas?: unknown }).plataformas;
            setPlataformas(Array.isArray(lista) ? (lista as Plataforma[]) : []);
            setErrorPlataformas(false);
        } catch {
            setErrorPlataformas(true);
        }
    }

    async function cargar(id: string) {
        setLoading(true);
        setError("");
        try {
            const [resProfesor, resIdentificadores] = await Promise.all([
                fetch(`/api/colegio/profesores/${id}`, { credentials: "include" }),
                fetch(`/api/colegio/profesores/${id}/identificadores`, { credentials: "include" }),
            ]);
            const dataProfesor = await resProfesor.json().catch(() => ({}));
            const dataIdentificadores = await resIdentificadores.json().catch(() => ({}));

            if (resProfesor.ok && dataProfesor.profesor) {
                setProfesor(dataProfesor.profesor);
            } else if (resProfesor.status === 404 || resProfesor.status === 403) {
                setError(dataProfesor?.error?.message || "No tienes acceso a este profesor");
                setLoading(false);
                return;
            }

            if (resIdentificadores.ok) {
                setIdentificadores(dataIdentificadores.identificadores || []);
            }
        } catch {
            setError("Error de red cargando el profesor");
        } finally {
            setLoading(false);
        }
    }

    function abrirNuevo() {
        setEditando(null);
        setNuevo(IDENTIFICADOR_VACIO);
        setModalOpen(true);
    }

    function abrirEditar(identificador: Identificador) {
        setEditando(identificador);
        setNuevo({ valor: identificador.valor, plataformaId: identificador.plataformaId ?? "" });
        setModalOpen(true);
    }

    async function guardar() {
        if (!profesorId || !nuevo.valor.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const url = editando
                ? `/api/colegio/identificadores-profesor/${editando.id}`
                : `/api/colegio/profesores/${profesorId}/identificadores`;
            const res = await fetch(url, {
                method: editando ? "PATCH" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    valor: nuevo.valor.trim(),
                    ...(nuevo.plataformaId ? { plataformaId: nuevo.plataformaId } : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setModalOpen(false);
                setNuevo(IDENTIFICADOR_VACIO);
                setEditando(null);
                setMessage({ type: "success", text: editando ? "Identificador actualizado" : "Identificador agregado" });
                await cargar(profesorId);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error guardando identificador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red guardando identificador" });
        } finally {
            setSaving(false);
        }
    }

    async function toggleEstado(identificador: Identificador) {
        if (!profesorId) return;
        const nuevoEstado = identificador.estado === "activo" ? "inactivo" : "activo";
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/identificadores-profesor/${identificador.id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoEstado),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Identificador ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                await cargar(profesorId);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando estado" });
        }
    }

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Button variant="outline" onClick={() => router.push("/dashboard/colegio/profesores")} className="mb-2">
                                ← Volver a profesores
                            </Button>
                            <h1 className="text-2xl font-bold text-body">
                                {profesor ? `${profesor.nombre} ${profesor.apellidos}` : "Profesor"}
                            </h1>
                            {profesor?.estado && (
                                <Badge variant={profesor.estado === "activo" ? "success" : "neutral"} className="mt-2">
                                    {profesor.estado === "activo" ? "Activo" : "Inactivo"}
                                </Badge>
                            )}
                        </div>
                        <Button onClick={abrirNuevo}>Nuevo identificador</Button>
                    </div>

                    {message && (
                        <div
                            className={`rounded-xl p-4 text-sm ${
                                message.type === "error"
                                    ? "bg-rubi/10 text-estado-rubi dark:bg-rubi/20"
                                    : "bg-pino/10 text-estado-pino dark:bg-pino/20"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center gap-3 py-8 text-muted">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-tinta/15 border-t-pino" />
                            Cargando...
                        </div>
                    ) : error ? (
                        <ErrorState title="No pudimos cargar el profesor" description={error} onRetry={() => profesorId && cargar(profesorId)} />
                    ) : profesor ? (
                        <>
                            <GlassCard>
                                <h2 className="text-lg font-semibold text-body">Contacto</h2>
                                <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                    <p>
                                        <span className="text-muted">Email:</span>{" "}
                                        {profesor.email || "—"}
                                    </p>
                                    <p>
                                        <span className="text-muted">Teléfono:</span>{" "}
                                        {profesor.telefono || "—"}
                                    </p>
                                </div>
                            </GlassCard>

                            <GlassCard>
                                <h2 className="text-lg font-semibold text-body">Identificadores para alertas</h2>
                                {identificadores.length === 0 ? (
                                    <EmptyState
                                        title="No hay identificadores"
                                        description="Agregue un identificador para usar en futuras alertas."
                                        action={<Button onClick={abrirNuevo}>Agregar identificador</Button>}
                                    />
                                ) : (
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="border-b border-tinta/15">
                                                <tr className="text-subtle">
                                                    <th className="pb-3 font-medium">Valor</th>
                                                    <th className="pb-3 font-medium">Tipo</th>
                                                    <th className="pb-3 font-medium">Plataforma</th>
                                                    <th className="pb-3 font-medium">Estado</th>
                                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-tinta/10">
                                                {identificadores.map((identificador) => (
                                                    <tr key={identificador.id} className="align-top">
                                                        <td className="py-3 pr-3 font-medium text-body">{identificador.valor}</td>
                                                        <td className="py-3 pr-3 text-muted">{identificador.tipo}</td>
                                                        <td className="py-3 pr-3 text-muted">{identificador.plataforma?.nombre || "—"}</td>
                                                        <td className="py-3 pr-3">
                                                            <Badge variant={identificador.estado === "activo" ? "success" : "neutral"}>
                                                                {identificador.estado === "activo" ? "Activo" : "Inactivo"}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <span className="inline-flex flex-wrap justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    className="px-3 py-1.5 text-xs"
                                                                    onClick={() => abrirEditar(identificador)}
                                                                >
                                                                    Editar
                                                                </Button>
                                                                <Button
                                                                    variant={identificador.estado === "activo" ? "danger" : "secondary"}
                                                                    className="px-3 py-1.5 text-xs"
                                                                    onClick={() => toggleEstado(identificador)}
                                                                >
                                                                    {identificador.estado === "activo" ? "Desactivar" : "Activar"}
                                                                </Button>
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </GlassCard>
                        </>
                    ) : null}
                </div>
            </main>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editando ? "Editar identificador" : "Agregar identificador"}>
                <div className="space-y-4">
                    <Input
                        label="Valor"
                        required
                        maxLength={255}
                        value={nuevo.valor}
                        onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })}
                        placeholder="Ej. +573001234567, correo@dominio.com o nick"
                    />
                    {errorPlataformas && (
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-rubi/10 p-3 text-sm text-estado-rubi dark:bg-rubi/20">
                            <span>No se pudieron cargar las plataformas — reintenta</span>
                            <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={cargarPlataformas}>
                                Reintentar
                            </Button>
                        </div>
                    )}
                    <Select
                        label="Plataforma"
                        options={[{ value: "", label: "Ninguna / General" }, ...plataformas.map((p) => ({ value: p.id, label: p.nombre }))]}
                        value={nuevo.plataformaId}
                        onChange={(e) => setNuevo({ ...nuevo, plataformaId: e.target.value })}
                    />
                    {plataformas.length === 0 && !errorPlataformas && (
                        <p className="text-xs text-muted">Cargando plataformas… el guardado se habilita cuando estén disponibles.</p>
                    )}
                    <div className="flex items-center gap-3">
                        <Button onClick={guardar} isLoading={saving} disabled={plataformas.length === 0}>
                            Guardar
                        </Button>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

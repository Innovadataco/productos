"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";

/**
 * SPEC-148 (US1, FR-001) — Pantalla de profesores: lista, crea, edita, da de
 * baja y reactiva con el CRUD EXISTENTE de SPEC-145 (los endpoints no se
 * tocan). ui/Tabla, filtro activos (default)/inactivos/todos, buscador por
 * nombre con debounce 280 ms (§9), formulario con validación humana (§4.6:
 * los 400/409 del endpoint llegan con su mensaje y se muestran tal cual).
 * Baja = soft delete: la fila EXISTE y los cursos la conservan como titular
 * histórico "· inactiva" (COND-2 de SPEC-145) — aquí solo cambia el estado.
 * Terminología §3: "profesor", jamás docente/maestro. Tap targets ≥ 48px.
 */

type Profesor = {
    id: string;
    nombre: string;
    apellidos: string;
    email: string | null;
    telefono: string | null;
    estado: string;
};

type Mensaje = { type: "success" | "error"; text: string } | null;

type EstadoModal = { modo: "crear" } | { modo: "editar"; profesor: Profesor } | null;

const DEBOUNCE_MS = 280;

const FILTRO_OPTIONS = [
    { value: "activo", label: "Activos" },
    { value: "inactivo", label: "Inactivos" },
    { value: "todos", label: "Todos" },
];

const FORM_VACIO = { nombre: "", apellidos: "", email: "", telefono: "" };

export default function ProfesoresPageClient() {
    const [profesores, setProfesores] = useState<Profesor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState<Mensaje>(null);
    const [filtroEstado, setFiltroEstado] = useState("activo");

    const [texto, setTexto] = useState("");
    const [filtroTexto, setFiltroTexto] = useState("");

    const [modal, setModal] = useState<EstadoModal>(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const [cambiandoId, setCambiandoId] = useState<string | null>(null);

    // Debounce del buscador (§9: 250-300 ms).
    useEffect(() => {
        const temporizador = setTimeout(() => setFiltroTexto(texto), DEBOUNCE_MS);
        return () => clearTimeout(temporizador);
    }, [texto]);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/colegio/profesores?estado=${filtroEstado}&pageSize=100`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setProfesores(data.items || []);
            } else if (res.status === 403) {
                setError(data?.error?.message || "El servicio del colegio no está vigente");
            } else {
                setError(data?.error?.message || "Error cargando profesores");
            }
        } catch {
            setError("Error de red cargando profesores");
        } finally {
            setLoading(false);
        }
    }, [filtroEstado]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const filtrados = useMemo(() => {
        const busqueda = filtroTexto.trim().toLowerCase();
        if (!busqueda) return profesores;
        return profesores.filter((p) => `${p.nombre} ${p.apellidos}`.toLowerCase().includes(busqueda));
    }, [profesores, filtroTexto]);

    function abrirCrear() {
        setForm(FORM_VACIO);
        setFormError("");
        setModal({ modo: "crear" });
    }

    function abrirEditar(profesor: Profesor) {
        setForm({
            nombre: profesor.nombre,
            apellidos: profesor.apellidos,
            email: profesor.email ?? "",
            telefono: profesor.telefono ?? "",
        });
        setFormError("");
        setModal({ modo: "editar", profesor });
    }

    async function guardar() {
        if (!form.nombre.trim() || !form.apellidos.trim()) {
            setFormError("Completa el nombre y los apellidos del profesor");
            return;
        }
        if (!modal) return;
        setSaving(true);
        setFormError("");
        try {
            const esCrear = modal.modo === "crear";
            const url = esCrear ? "/api/colegio/profesores" : `/api/colegio/profesores/${modal.profesor.id}`;
            // Vacío ≡ sin dato: en alta se omite; en edición se manda null (borra).
            const email = form.email.trim();
            const telefono = form.telefono.trim();
            const body = {
                nombre: form.nombre.trim(),
                apellidos: form.apellidos.trim(),
                ...(esCrear
                    ? { ...(email ? { email } : {}), ...(telefono ? { telefono } : {}) }
                    : { email: email || null, telefono: telefono || null }),
            };
            const res = await fetch(url, {
                method: esCrear ? "POST" : "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setModal(null);
                setMessage({ type: "success", text: esCrear ? "Profesor agregado" : "Profesor actualizado" });
                await cargar();
            } else {
                // 400/409: el endpoint ya manda el mensaje humano (§4.6).
                setFormError(data?.error?.message || "No pudimos guardar el profesor");
            }
        } catch {
            setFormError("Error de red guardando el profesor");
        } finally {
            setSaving(false);
        }
    }

    async function cambiarEstado(profesor: Profesor) {
        const nuevoEstado = profesor.estado === "activo" ? "inactivo" : "activo";
        setCambiandoId(profesor.id);
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/profesores/${profesor.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevoEstado }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({
                    type: "success",
                    text:
                        nuevoEstado === "inactivo"
                            ? `${profesor.nombre} ${profesor.apellidos} dado de baja. Sigue como titular histórico de sus cursos.`
                            : `${profesor.nombre} ${profesor.apellidos} reactivado`,
                });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando el estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando el estado" });
        } finally {
            setCambiandoId(null);
        }
    }

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Profesores</h1>
                            <p className="text-sm text-muted">El directorio de profesores de tu colegio.</p>
                        </div>
                        <Button className="min-h-12" onClick={abrirCrear}>
                            Agregar profesor
                        </Button>
                    </div>

                    {message && (
                        <div
                            role="status"
                            className={`rounded-xl p-4 text-sm ${
                                message.type === "error"
                                    ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                                    : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                            }`}
                        >
                            {message.text}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="w-full sm:max-w-sm">
                            <Input
                                aria-label="Buscar por nombre"
                                placeholder="Buscar por nombre..."
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <Select
                                aria-label="Filtrar por estado"
                                options={FILTRO_OPTIONS}
                                value={filtroEstado}
                                onChange={(e) => setFiltroEstado(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="glass rounded-2xl p-8">
                            <div className="flex items-center gap-3 text-muted">
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                Cargando profesores...
                            </div>
                        </div>
                    ) : error ? (
                        <ErrorState title="No pudimos cargar los profesores" description={error} onRetry={cargar} />
                    ) : profesores.length === 0 && !filtroTexto.trim() ? (
                        <EmptyState
                            title={
                                filtroEstado === "inactivo"
                                    ? "No hay profesores dados de baja"
                                    : "No hay profesores registrados"
                            }
                            description="Agrega el primer profesor para asignarlo como titular de los cursos."
                            action={
                                <Button className="min-h-12" onClick={abrirCrear}>
                                    Agregar profesor
                                </Button>
                            }
                        />
                    ) : (
                        <Tabla aria-label="Profesores del colegio">
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 pt-4 pl-4 font-medium">Profesor</th>
                                    <th className="pb-3 pt-4 font-medium">Contacto</th>
                                    <th className="pb-3 pt-4 font-medium">Estado</th>
                                    <th className="pb-3 pt-4 pr-4 text-right font-medium">Acciones</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {filtrados.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-6 text-center text-sm text-muted">
                                            Sin resultados para «{filtroTexto.trim()}».
                                        </td>
                                    </tr>
                                ) : (
                                    filtrados.map((profesor) => (
                                        <tr key={profesor.id} className="align-top">
                                            <td className="py-3 pl-4 pr-3 font-medium text-body">
                                                {profesor.nombre} {profesor.apellidos}
                                            </td>
                                            <td className="py-3 pr-3 text-muted">
                                                {profesor.email || profesor.telefono ? (
                                                    <>
                                                        {profesor.email && <span className="block">{profesor.email}</span>}
                                                        {profesor.telefono && <span className="block">{profesor.telefono}</span>}
                                                    </>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="py-3 pr-3">
                                                <Badge variant={profesor.estado === "activo" ? "success" : "neutral"}>
                                                    {profesor.estado === "activo" ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pr-4 text-right">
                                                <span className="inline-flex flex-wrap justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        className="min-h-12 px-3 text-xs"
                                                        onClick={() => abrirEditar(profesor)}
                                                    >
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        variant={profesor.estado === "activo" ? "danger" : "secondary"}
                                                        className="min-h-12 px-3 text-xs"
                                                        isLoading={cambiandoId === profesor.id}
                                                        onClick={() => cambiarEstado(profesor)}
                                                    >
                                                        {profesor.estado === "activo" ? "Dar de baja" : "Reactivar"}
                                                    </Button>
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </TablaBody>
                        </Tabla>
                    )}
                </div>
            </main>

            <Modal
                isOpen={modal !== null}
                onClose={() => setModal(null)}
                title={modal?.modo === "editar" ? "Editar profesor" : "Agregar profesor"}
            >
                <div className="space-y-4">
                    {formError && (
                        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                            {formError}
                        </p>
                    )}
                    <Input
                        label="Nombre"
                        required
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                    <Input
                        label="Apellidos"
                        required
                        value={form.apellidos}
                        onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                    />
                    <Input
                        label="Email (opcional)"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <Input
                        label="Teléfono (opcional)"
                        value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                    <div className="flex items-center gap-3">
                        <Button className="min-h-12" onClick={guardar} isLoading={saving}>
                            Guardar
                        </Button>
                        <Button variant="outline" className="min-h-12" onClick={() => setModal(null)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

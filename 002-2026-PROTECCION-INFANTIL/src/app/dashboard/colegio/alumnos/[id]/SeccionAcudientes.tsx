"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";

type Identificador = {
    id: string;
    tipo: string;
    valor: string;
    plataformaId: string | null;
    plataforma: { id: string; clave: string; nombre: string } | null;
    estado: string;
};

type Acudiente = {
    id: string;
    orden: number;
    nombre: string;
    relacion: string;
    telefono: string | null;
    email: string | null;
    // SPEC-344 (D-acud): documento OPCIONAL del acudiente.
    documentoTipo?: string | null;
    documentoNumero?: string | null;
    estado: string;
    identificadores: Identificador[];
};

type Plataforma = { id: string; clave: string; nombre: string };

type Mensaje = { type: "success" | "error"; text: string } | null;

const ACUDIENTE_VACIO = {
    orden: 1 as 1 | 2,
    nombre: "",
    relacion: "",
    telefono: "",
    email: "",
    // SPEC-344 (D-acud): documento del acudiente OPCIONAL (mockup 1.6).
    documentoTipo: "",
    documentoNumero: "",
};
const IDENTIFICADOR_VACIO = { valor: "", plataformaId: "" };

interface SeccionAcudientesProps {
    estudianteId: string;
}

export default function SeccionAcudientes({ estudianteId }: SeccionAcudientesProps) {
    const [acudientes, setAcudientes] = useState<Acudiente[]>([]);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<Mensaje>(null);
    const [saving, setSaving] = useState(false);

    const [modalAcudienteOpen, setModalAcudienteOpen] = useState(false);
    const [editandoAcudiente, setEditandoAcudiente] = useState<Acudiente | null>(null);
    const [formAcudiente, setFormAcudiente] = useState(ACUDIENTE_VACIO);

    const [modalIdentificadorOpen, setModalIdentificadorOpen] = useState(false);
    const [acudienteParaIdentificador, setAcudienteParaIdentificador] = useState<Acudiente | null>(null);
    const [editandoIdentificador, setEditandoIdentificador] = useState<Identificador | null>(null);
    const [formIdentificador, setFormIdentificador] = useState(IDENTIFICADOR_VACIO);

    const cargar = useCallback(async () => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/alumnos/${estudianteId}/acudientes`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setAcudientes(data.acudientes || []);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando acudientes" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando acudientes" });
        } finally {
            setLoading(false);
        }
    }, [estudianteId]);

    useEffect(() => {
        cargar();
        fetch("/api/plataformas", { credentials: "include" })
            .then((r) => r.json().catch(() => ({})))
            .then((data) => setPlataformas(data.plataformas || []))
            .catch(() => {});
    }, [cargar]);

    function abrirNuevoAcudiente() {
        const siguienteOrden = acudientes.length === 0 ? 1 : acudientes.some((a) => a.orden === 1) ? 2 : 1;
        setFormAcudiente({ ...ACUDIENTE_VACIO, orden: siguienteOrden as 1 | 2 });
        setEditandoAcudiente(null);
        setModalAcudienteOpen(true);
    }

    function abrirEditarAcudiente(acudiente: Acudiente) {
        setFormAcudiente({
            orden: acudiente.orden as 1 | 2,
            nombre: acudiente.nombre,
            relacion: acudiente.relacion,
            telefono: acudiente.telefono ?? "",
            email: acudiente.email ?? "",
            documentoTipo: acudiente.documentoTipo ?? "",
            documentoNumero: acudiente.documentoNumero ?? "",
        });
        setEditandoAcudiente(acudiente);
        setModalAcudienteOpen(true);
    }

    async function guardarAcudiente() {
        if (!formAcudiente.nombre.trim() || !formAcudiente.relacion.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const url = editandoAcudiente
                ? `/api/colegio/alumnos/${estudianteId}/acudientes/${editandoAcudiente.id}`
                : `/api/colegio/alumnos/${estudianteId}/acudientes`;
            const res = await fetch(url, {
                method: editandoAcudiente ? "PATCH" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: formAcudiente.nombre.trim(),
                    relacion: formAcudiente.relacion.trim(),
                    ...(formAcudiente.telefono.trim() ? { telefono: formAcudiente.telefono.trim() } : {}),
                    ...(formAcudiente.email.trim() ? { email: formAcudiente.email.trim() } : {}),
                    // SPEC-344 (D-acud): documento opcional — solo viaja si viene.
                    ...(formAcudiente.documentoTipo.trim() ? { documentoTipo: formAcudiente.documentoTipo.trim() } : {}),
                    ...(formAcudiente.documentoNumero.trim() ? { documentoNumero: formAcudiente.documentoNumero.trim() } : {}),
                    ...(!editandoAcudiente ? { orden: formAcudiente.orden } : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setModalAcudienteOpen(false);
                setMessage({ type: "success", text: editandoAcudiente ? "Acudiente actualizado" : "Acudiente agregado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error guardando acudiente" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red guardando acudiente" });
        } finally {
            setSaving(false);
        }
    }

    async function toggleEstadoAcudiente(acudiente: Acudiente) {
        const nuevoEstado = acudiente.estado === "activo" ? "inactivo" : "activo";
        setMessage(null);
        try {
            const res = await fetch(`/api/colegio/alumnos/${estudianteId}/acudientes/${acudiente.id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoEstado),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Acudiente ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando estado" });
        }
    }

    function abrirNuevoIdentificador(acudiente: Acudiente) {
        setAcudienteParaIdentificador(acudiente);
        setEditandoIdentificador(null);
        setFormIdentificador(IDENTIFICADOR_VACIO);
        setModalIdentificadorOpen(true);
    }

    function abrirEditarIdentificador(acudiente: Acudiente, identificador: Identificador) {
        setAcudienteParaIdentificador(acudiente);
        setEditandoIdentificador(identificador);
        setFormIdentificador({ valor: identificador.valor, plataformaId: identificador.plataformaId ?? "" });
        setModalIdentificadorOpen(true);
    }

    async function guardarIdentificador() {
        if (!acudienteParaIdentificador || !formIdentificador.valor.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const url = editandoIdentificador
                ? `/api/colegio/acudientes/${acudienteParaIdentificador.id}/identificadores/${editandoIdentificador.id}`
                : `/api/colegio/acudientes/${acudienteParaIdentificador.id}/identificadores`;
            const res = await fetch(url, {
                method: editandoIdentificador ? "PATCH" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    valor: formIdentificador.valor.trim(),
                    ...(formIdentificador.plataformaId ? { plataformaId: formIdentificador.plataformaId } : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setModalIdentificadorOpen(false);
                setMessage({ type: "success", text: editandoIdentificador ? "Identificador actualizado" : "Identificador agregado" });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error guardando identificador" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red guardando identificador" });
        } finally {
            setSaving(false);
        }
    }

    async function toggleEstadoIdentificador(acudiente: Acudiente, identificador: Identificador) {
        const nuevoEstado = identificador.estado === "activo" ? "inactivo" : "activo";
        setMessage(null);
        try {
            const res = await fetch(
                `/api/colegio/acudientes/${acudiente.id}/identificadores/${identificador.id}/estado`,
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(nuevoEstado),
                }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMessage({ type: "success", text: `Identificador ${nuevoEstado === "activo" ? "activado" : "desactivado"}` });
                await cargar();
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cambiando estado" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cambiando estado" });
        }
    }

    const puedeAgregarAcudiente = acudientes.length < 2;

    return (
        <GlassCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">
                        Acudientes ({acudientes.length} activo{acudientes.length === 1 ? "" : "s"})
                    </h2>
                    <p className="mt-1 text-sm text-muted">Hasta 2 contactos de reacción por estudiante.</p>
                </div>
                <Button onClick={abrirNuevoAcudiente} disabled={!puedeAgregarAcudiente || loading}>
                    + Agregar acudiente
                </Button>
            </div>

            {message ? (
                <div
                    className={`mt-4 rounded-xl p-4 text-sm ${
                        message.type === "error"
                            ? "bg-rubi/10 text-estado-rubi dark:bg-rubi/20"
                            : "bg-pino/10 text-estado-pino dark:bg-pino/20"
                    }`}
                >
                    {message.text}
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center gap-3 py-8 text-muted">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-tinta/15 border-t-pino" />
                    Cargando...
                </div>
            ) : acudientes.length === 0 ? (
                <div className="mt-4">
                    <EmptyState
                        title="No hay acudientes"
                        description="Agrega un acudiente para completar el anillo de reacción."
                        action={
                            <Button onClick={abrirNuevoAcudiente} disabled={!puedeAgregarAcudiente}>
                                Agregar acudiente
                            </Button>
                        }
                    />
                </div>
            ) : (
                <div className="mt-4 space-y-4">
                    {acudientes.map((acudiente) => (
                        <div
                            key={acudiente.id}
                            className="rounded-xl border border-tinta/15 p-4"
                        >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="font-semibold text-body">
                                        {acudiente.nombre}{" "}
                                        <span className="text-sm font-normal text-muted">({acudiente.relacion})</span>
                                    </p>
                                    <p className="text-sm text-subtle">
                                        {acudiente.telefono ? `Tel: ${acudiente.telefono}` : null}
                                        {acudiente.telefono && acudiente.email ? " · " : null}
                                        {acudiente.email ? `Email: ${acudiente.email}` : null}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="outline"
                                        className="px-3 py-1.5 text-xs"
                                        onClick={() => abrirEditarAcudiente(acudiente)}
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant={acudiente.estado === "activo" ? "danger" : "secondary"}
                                        className="px-3 py-1.5 text-xs"
                                        onClick={() => toggleEstadoAcudiente(acudiente)}
                                    >
                                        {acudiente.estado === "activo" ? "Desactivar" : "Activar"}
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-body">Identificadores para alertas</h3>
                                    <Button
                                        variant="ghost"
                                        className="h-auto px-2 py-1 text-xs"
                                        onClick={() => abrirNuevoIdentificador(acudiente)}
                                    >
                                        + Agregar identificador
                                    </Button>
                                </div>
                                {acudiente.identificadores.length === 0 ? (
                                    <p className="text-sm text-muted">Sin identificadores registrados.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {acudiente.identificadores.map((identificador) => (
                                            <li
                                                key={identificador.id}
                                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-tinta/5 p-2 text-sm"
                                            >
                                                <span className="text-body">
                                                    {identificador.valor}{" "}
                                                    <span className="text-subtle">({identificador.tipo})</span>
                                                    {identificador.plataforma ? (
                                                        <span className="text-subtle"> · {identificador.plataforma.nombre}</span>
                                                    ) : null}
                                                </span>
                                                <span className="inline-flex items-center gap-2">
                                                    <Badge variant={identificador.estado === "activo" ? "success" : "neutral"}>
                                                        {identificador.estado === "activo" ? "Activo" : "Inactivo"}
                                                    </Badge>
                                                    <Button
                                                        variant="outline"
                                                        className="h-auto px-2 py-1 text-xs"
                                                        onClick={() => abrirEditarIdentificador(acudiente, identificador)}
                                                    >
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        variant={identificador.estado === "activo" ? "danger" : "secondary"}
                                                        className="h-auto px-2 py-1 text-xs"
                                                        onClick={() => toggleEstadoIdentificador(acudiente, identificador)}
                                                    >
                                                        {identificador.estado === "activo" ? "Desactivar" : "Activar"}
                                                    </Button>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={modalAcudienteOpen} onClose={() => setModalAcudienteOpen(false)} title={editandoAcudiente ? "Editar acudiente" : "Agregar acudiente"}>
                <div className="space-y-4">
                    {!editandoAcudiente ? (
                        <Select
                            label="Orden"
                            required
                            options={[
                                { value: "1", label: "Principal (1)" },
                                { value: "2", label: "Secundario (2)" },
                            ]}
                            value={String(formAcudiente.orden)}
                            onChange={(e) => setFormAcudiente({ ...formAcudiente, orden: Number(e.target.value) as 1 | 2 })}
                        />
                    ) : null}
                    <Input
                        label="Nombre"
                        required
                        maxLength={150}
                        value={formAcudiente.nombre}
                        onChange={(e) => setFormAcudiente({ ...formAcudiente, nombre: e.target.value })}
                    />
                    <Input
                        label="Relación"
                        required
                        maxLength={50}
                        value={formAcudiente.relacion}
                        onChange={(e) => setFormAcudiente({ ...formAcudiente, relacion: e.target.value })}
                        placeholder="madre, padre, tutor…"
                    />
                    <Input
                        label="Teléfono"
                        maxLength={50}
                        value={formAcudiente.telefono}
                        onChange={(e) => setFormAcudiente({ ...formAcudiente, telefono: e.target.value })}
                    />
                    <Input
                        label="Email"
                        type="email"
                        maxLength={255}
                        value={formAcudiente.email}
                        onChange={(e) => setFormAcudiente({ ...formAcudiente, email: e.target.value })}
                    />
                    {/* SPEC-344 (D-acud · mockup 1.6): documento OPCIONAL. */}
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Tipo de documento (opcional)"
                            maxLength={20}
                            value={formAcudiente.documentoTipo}
                            onChange={(e) => setFormAcudiente({ ...formAcudiente, documentoTipo: e.target.value })}
                            placeholder="CC, CE, …"
                        />
                        <Input
                            label="Número de documento (opcional)"
                            maxLength={50}
                            value={formAcudiente.documentoNumero}
                            onChange={(e) => setFormAcudiente({ ...formAcudiente, documentoNumero: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={guardarAcudiente} isLoading={saving}>
                            Guardar
                        </Button>
                        <Button variant="outline" onClick={() => setModalAcudienteOpen(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={modalIdentificadorOpen} onClose={() => setModalIdentificadorOpen(false)} title={editandoIdentificador ? "Editar identificador" : "Agregar identificador"}>
                <div className="space-y-4">
                    <Input
                        label="Valor"
                        required
                        maxLength={255}
                        value={formIdentificador.valor}
                        onChange={(e) => setFormIdentificador({ ...formIdentificador, valor: e.target.value })}
                        placeholder="Ej. +573001234567, correo@dominio.com o nick"
                    />
                    <Select
                        label="Plataforma"
                        options={[{ value: "", label: "Ninguna / General" }, ...plataformas.map((p) => ({ value: p.id, label: p.nombre }))]}
                        value={formIdentificador.plataformaId}
                        onChange={(e) => setFormIdentificador({ ...formIdentificador, plataformaId: e.target.value })}
                    />
                    <div className="flex items-center gap-3">
                        <Button onClick={guardarIdentificador} isLoading={saving}>
                            Guardar
                        </Button>
                        <Button variant="outline" onClick={() => setModalIdentificadorOpen(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </GlassCard>
    );
}

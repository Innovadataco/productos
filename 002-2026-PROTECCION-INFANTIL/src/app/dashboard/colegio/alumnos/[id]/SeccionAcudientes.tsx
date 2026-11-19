"use client";

import { useEffect, useState, useCallback } from "react";
import { SkeletonLista } from "@/components/ui/skeletons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
    IdentificadoresParaAlertas,
    type ApiIdentificadores,
    type DatosIdentificador,
    type IdentificadorAlerta,
} from "@/components/modules/colegio/identificadores/IdentificadoresParaAlertas";

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
    identificadores: IdentificadorAlerta[];
};

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

interface SeccionAcudientesProps {
    estudianteId: string;
}

export default function SeccionAcudientes({ estudianteId }: SeccionAcudientesProps) {
    const [acudientes, setAcudientes] = useState<Acudiente[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<Mensaje>(null);
    const [saving, setSaving] = useState(false);

    const [modalAcudienteOpen, setModalAcudienteOpen] = useState(false);
    const [editandoAcudiente, setEditandoAcudiente] = useState<Acudiente | null>(null);
    const [formAcudiente, setFormAcudiente] = useState(ACUDIENTE_VACIO);


    // SPEC-932: `silencioso` recarga SIN pasar a skeleton — así el componente de identificadores no se desmonta y
    // conserva su mensaje de éxito tras guardar.
    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) {
            setLoading(true);
            setMessage(null);
        }
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
        void cargar();
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

    // SPEC-932 · adaptador del acudiente. El alta NO acepta `plataformaId: null` (se omite); la edición sí (limpia).
    function cuerpoAcudiente(d: DatosIdentificador, edicion: boolean): Record<string, unknown> {
        return {
            valor: d.valor,
            ...(d.plataformaId ? { plataformaId: d.plataformaId } : edicion ? { plataformaId: null } : {}),
            ...(d.confirmarCompartido ? { confirmarCompartido: true } : {}),
        };
    }
    function apiDe(acudiente: Acudiente): ApiIdentificadores {
        const base = `/api/colegio/acudientes/${acudiente.id}/identificadores`;
        const enviar = (url: string, method: "POST" | "PATCH", body: unknown) =>
            fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return {
            crear: (d) => enviar(base, "POST", cuerpoAcudiente(d, false)),
            editar: (i, d) => enviar(`${base}/${i.id}`, "PATCH", cuerpoAcudiente(d, true)),
            cambiarEstado: (i, estado) => enviar(`${base}/${i.id}/estado`, "PATCH", estado),
        };
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
                <SkeletonLista />
            ) : acudientes.length === 0 ? (
                <div className="mt-4">
                    <EmptyState
                        title="No hay acudientes"
                        description="Agregue un acudiente para completar el anillo de reacción."
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

                            {/* SPEC-932: el patrón ÚNICO (FORMA SPEC-931 §2.3/§4), anidado bajo el acudiente. */}
                            <IdentificadoresParaAlertas
                                identificadores={acudiente.identificadores}
                                api={apiDe(acudiente)}
                                onCambio={() => cargar(true)}
                                variante="anidado"
                            />
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

        </GlassCard>
    );
}

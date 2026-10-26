"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useTipoDocumentoOpciones } from "../unificado/useTipoDocumentoOpciones";

/**
 * SPEC-147 (US3, FR-005) — Agregar estudiante desde la vista del curso:
 * nombre + apellidos obligatorios y UN acudiente opcional (nombre, relación,
 * teléfono, email — cualquier dato de contacto sirve para que no quede "sin
 * contactos"). Usa el endpoint EXISTENTE `POST /api/colegio/cursos/[id]/alumnos`
 * (atómico con acudientes, SPEC-144) sin tocarlo.
 *
 * SPEC-910: SPEC-320 (§2.2-bis) volvió OBLIGATORIO el documento del estudiante en
 * `estudianteBodySchema`, pero este modal quedó atrás y posteaba sin él → el endpoint
 * devolvía 400 y el usuario no tenía dónde ponerlo. Se agregan tipo + número de
 * documento (el select reusa `useTipoDocumentoOpciones`, la misma fuente del wizard),
 * validados client-side ANTES de postear (mensaje inline, no el 400 crudo).
 */

interface FormAgregarEstudianteProps {
    cursoId: string;
    isOpen: boolean;
    onClose: () => void;
    /** Alta exitosa: el padre muestra el aviso y refresca los datos del servidor. */
    onCreado: () => void;
}

const ACUDIENTE_VACIO = { nombre: "", relacion: "", telefono: "", email: "" };

export function FormAgregarEstudiante({ cursoId, isOpen, onClose, onCreado }: FormAgregarEstudianteProps) {
    const [nombre, setNombre] = useState("");
    const [apellidos, setApellidos] = useState("");
    const [documentoTipo, setDocumentoTipo] = useState("");
    const [documentoNumero, setDocumentoNumero] = useState("");
    const [conAcudiente, setConAcudiente] = useState(false);
    const [acudiente, setAcudiente] = useState(ACUDIENTE_VACIO);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const documentoTipoOpciones = useTipoDocumentoOpciones();

    // Al abrir: formulario limpio (el modal conserva el estado entre aperturas).
    useEffect(() => {
        if (isOpen) {
            setNombre("");
            setApellidos("");
            setDocumentoTipo("");
            setDocumentoNumero("");
            setConAcudiente(false);
            setAcudiente(ACUDIENTE_VACIO);
            setError("");
        }
    }, [isOpen]);

    async function agregar() {
        const nombreLimpio = nombre.trim();
        const apellidosLimpios = apellidos.trim();
        if (nombreLimpio.length < 2 || apellidosLimpios.length < 1) {
            setError("Nombre y apellidos del estudiante son obligatorios.");
            return;
        }
        // SPEC-910: el documento es obligatorio (SPEC-320 §2.2-bis). Se valida acá
        // ANTES de postear para mostrar un mensaje inline, no el 400 del endpoint.
        const documentoNumeroLimpio = documentoNumero.trim();
        if (!documentoTipo || documentoNumeroLimpio.length < 1) {
            setError("Seleccione el tipo y escriba el número de documento del estudiante.");
            return;
        }
        const acudienteCompleto = conAcudiente && acudiente.nombre.trim().length >= 2 && acudiente.relacion.trim().length >= 1;
        if (conAcudiente && !acudienteCompleto) {
            setError("El acudiente necesita al menos nombre y relación (o quítelo).");
            return;
        }

        setGuardando(true);
        setError("");
        try {
            const res = await fetch(`/api/colegio/cursos/${cursoId}/alumnos`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: nombreLimpio,
                    apellidos: apellidosLimpios,
                    documentoTipo,
                    documentoNumero: documentoNumeroLimpio,
                    ...(acudienteCompleto
                        ? {
                            acudientes: [
                                {
                                    orden: 1,
                                    nombre: acudiente.nombre.trim(),
                                    relacion: acudiente.relacion.trim(),
                                    ...(acudiente.telefono.trim() ? { telefono: acudiente.telefono.trim() } : {}),
                                    ...(acudiente.email.trim() ? { email: acudiente.email.trim() } : {}),
                                },
                            ],
                        }
                        : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onCreado();
                onClose();
            } else {
                setError(data?.error?.message || "No pudimos agregar el estudiante. Inténtelo de nuevo.");
            }
        } catch {
            setError("Error de red agregando el estudiante. Inténtelo de nuevo.");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Agregar estudiante">
            <div className="space-y-4">
                <Input
                    label="Nombre del estudiante"
                    required
                    minLength={2}
                    maxLength={150}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. María"
                />
                <Input
                    label="Apellidos"
                    required
                    minLength={1}
                    maxLength={150}
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    placeholder="Ej. Gómez Torres"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select
                        label="Tipo de documento"
                        options={documentoTipoOpciones}
                        value={documentoTipo}
                        onChange={(e) => setDocumentoTipo(e.target.value)}
                    />
                    <Input
                        label="Número de documento"
                        required
                        minLength={1}
                        maxLength={50}
                        value={documentoNumero}
                        onChange={(e) => setDocumentoNumero(e.target.value)}
                        placeholder="Ej. 1012345678"
                    />
                </div>

                {conAcudiente ? (
                    <div className="space-y-3 rounded-xl bg-tinta/5 p-3" aria-label="Acudiente del estudiante">
                        <p className="text-xs font-semibold text-subtle">Acudiente (opcional)</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Input
                                aria-label="Nombre del acudiente"
                                placeholder="Nombre del acudiente"
                                maxLength={150}
                                value={acudiente.nombre}
                                onChange={(e) => setAcudiente({ ...acudiente, nombre: e.target.value })}
                            />
                            <Input
                                aria-label="Relación del acudiente"
                                placeholder="Relación (madre, padre, tutor…)"
                                maxLength={50}
                                value={acudiente.relacion}
                                onChange={(e) => setAcudiente({ ...acudiente, relacion: e.target.value })}
                            />
                            <Input
                                aria-label="Teléfono del acudiente"
                                placeholder="Teléfono"
                                maxLength={50}
                                value={acudiente.telefono}
                                onChange={(e) => setAcudiente({ ...acudiente, telefono: e.target.value })}
                            />
                            <Input
                                aria-label="Email del acudiente"
                                placeholder="Email"
                                maxLength={255}
                                value={acudiente.email}
                                onChange={(e) => setAcudiente({ ...acudiente, email: e.target.value })}
                            />
                        </div>
                        <Button type="button" variant="ghost" className="min-h-12" onClick={() => setConAcudiente(false)}>
                            Quitar acudiente
                        </Button>
                    </div>
                ) : (
                    <Button type="button" variant="ghost" className="min-h-12" onClick={() => setConAcudiente(true)}>
                        + Agregar acudiente (opcional)
                    </Button>
                )}

                {error ? (
                    <p role="alert" className="text-sm font-semibold text-estado-rubi">
                        {error}
                    </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={agregar} isLoading={guardando} className="min-h-12">
                        Agregar
                    </Button>
                    <Button variant="outline" className="min-h-12" onClick={onClose}>
                        Cancelar
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

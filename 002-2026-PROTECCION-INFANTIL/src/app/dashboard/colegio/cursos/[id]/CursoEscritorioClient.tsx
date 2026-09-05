"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { GRADO_OPTIONS } from "@/lib/colegio/grados";
import type { CursoDetalle } from "@/lib/dal/repositories/colegio-resumen";
import { CursoHeader } from "@/components/modules/colegio/curso/CursoHeader";
import { TarjetasCurso } from "@/components/modules/colegio/curso/TarjetasCurso";
import { AnilloCurso } from "@/components/modules/colegio/curso/AnilloCurso";
import { TablaEstudiantes } from "@/components/modules/colegio/curso/TablaEstudiantes";
import type { EstudianteFila } from "@/components/modules/colegio/curso/TablaEstudiantes";
import { FormAgregarEstudiante } from "@/components/modules/colegio/curso/FormAgregarEstudiante";
import SeccionMateriasCurso from "@/components/modules/colegio/curso/SeccionMateriasCurso";

/**
 * SPEC-147 (FR-001/FR-005) — Escritorio del curso (mockup §5.5). REEMPLAZA
 * CursoDetallePageClient conservando TODAS sus capacidades: editar el curso
 * (ahora con selector de titular same-tenant), agregar estudiante (ahora con
 * acudiente opcional) y activar/desactivar — siempre contra los endpoints
 * EXISTENTES (intactos). Los datos llegan del servidor (UNA llamada al DAL);
 * tras cada mutación, `router.refresh()` los recarga.
 */

type Aviso = { tipo: "exito" | "error"; mensaje: string } | null;

interface ProfesorOpcion {
    id: string;
    nombre: string;
    apellidos: string;
}

interface CursoEscritorioClientProps {
    datos: CursoDetalle;
}

export default function CursoEscritorioClient({ datos }: CursoEscritorioClientProps) {
    const router = useRouter();
    const [aviso, setAviso] = useState<Aviso>(null);
    const [agregando, setAgregando] = useState(false);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [togglingObservacionId, setTogglingObservacionId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ nombre: "", grado: "", anioLectivo: "", profesorTitularId: "" });
    const [profesores, setProfesores] = useState<ProfesorOpcion[]>([]);
    const [cargandoProfesores, setCargandoProfesores] = useState(false);
    const [confirmandoDuplicar, setConfirmandoDuplicar] = useState(false);
    const [duplicando, setDuplicando] = useState(false);

    const { curso } = datos;
    const totalEstudiantes = datos.estudiantes.length;
    const coberturaPct = Math.round(datos.cobertura.vigilancia * 100);

    function manejarAviso(mensaje: string, tipo: "exito" | "error" = "exito") {
        setAviso({ tipo, mensaje });
    }

    function abrirEdicion() {
        setEditForm({
            nombre: curso.nombre,
            grado: curso.grado ?? "",
            anioLectivo: curso.anioLectivo ?? "",
            profesorTitularId: curso.profesorTitularId ?? "",
        });
        setEditando(true);
    }

    // Selector de titular same-tenant (SPEC-145 D1): profesores ACTIVOS del
    // colegio, del endpoint existente. Se carga solo al abrir la edición.
    useEffect(() => {
        if (!editando) return;
        let cancelado = false;
        setCargandoProfesores(true);
        fetch("/api/colegio/profesores?estado=activo&pageSize=100", { credentials: "include" })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!cancelado && res.ok) setProfesores(data.items ?? []);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelado) setCargandoProfesores(false);
            });
        return () => {
            cancelado = true;
        };
    }, [editando]);

    async function duplicarCurso() {
        setDuplicando(true);
        setAviso(null);
        try {
            const res = await fetch(`/api/colegio/cursos/${curso.id}/duplicar`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.curso?.id) {
                setConfirmandoDuplicar(false);
                setAviso({ tipo: "exito", mensaje: `Curso duplicado: ${data.curso.nombre} (${data.curso.anioLectivo}).` });
                router.push(`/dashboard/colegio/cursos/${data.curso.id}`);
            } else {
                setAviso({ tipo: "error", mensaje: data?.error?.message || "No pudimos duplicar el curso." });
            }
        } catch {
            setAviso({ tipo: "error", mensaje: "Error de red duplicando el curso." });
        } finally {
            setDuplicando(false);
        }
    }

    async function guardarEdicion() {
        if (!editForm.nombre.trim()) return;
        setGuardando(true);
        setAviso(null);
        try {
            const res = await fetch(`/api/colegio/cursos/${curso.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: editForm.nombre.trim(),
                    grado: editForm.grado.trim() || null,
                    anioLectivo: editForm.anioLectivo.trim() || null,
                    // null desasigna explícitamente; la ruta valida same-tenant.
                    profesorTitularId: editForm.profesorTitularId || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setEditando(false);
                setAviso({ tipo: "exito", mensaje: "Curso actualizado." });
                router.refresh();
            } else {
                setAviso({ tipo: "error", mensaje: data?.error?.message || "No pudimos actualizar el curso." });
            }
        } catch {
            setAviso({ tipo: "error", mensaje: "Error de red actualizando el curso." });
        } finally {
            setGuardando(false);
        }
    }

    async function toggleEstadoEstudiante(estudiante: EstudianteFila) {
        const nuevoEstado = estudiante.estado === "activo" ? "inactivo" : "activo";
        setTogglingId(estudiante.id);
        setAviso(null);
        try {
            const res = await fetch(`/api/colegio/alumnos/${estudiante.id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevoEstado),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setAviso({
                    tipo: "exito",
                    mensaje: nuevoEstado === "activo" ? "Estudiante activado." : "Estudiante desactivado.",
                });
                router.refresh();
            } else {
                setAviso({ tipo: "error", mensaje: data?.error?.message || "No pudimos cambiar el estado." });
            }
        } catch {
            setAviso({ tipo: "error", mensaje: "Error de red cambiando el estado." });
        } finally {
            setTogglingId(null);
        }
    }

    // SPEC-150 (US3): estrella de observación especial — POST marca, DELETE
    // desmarca (soft delete); tras cada cambio, refresh recarga el flag.
    async function toggleObservacion(estudiante: EstudianteFila) {
        setTogglingObservacionId(estudiante.id);
        setAviso(null);
        try {
            const res = await fetch(`/api/colegio/alumnos/${estudiante.id}/observacion`, {
                method: estudiante.observado ? "DELETE" : "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                ...(estudiante.observado ? {} : { body: JSON.stringify({}) }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setAviso({
                    tipo: "exito",
                    mensaje: estudiante.observado
                        ? "Observación especial retirada."
                        : "Estudiante marcado en observación especial: te avisaremos al primer reporte.",
                });
                router.refresh();
            } else {
                setAviso({ tipo: "error", mensaje: data?.error?.message || "No pudimos cambiar la observación." });
            }
        } catch {
            setAviso({ tipo: "error", mensaje: "Error de red cambiando la observación." });
        } finally {
            setTogglingObservacionId(null);
        }
    }

    // El titular inactivo no viene en la lista de activos: se ofrece marcado
    // para no perder la asignación vigente al editar (COND-2 de SPEC-145).
    const opcionesTitular = [
        { value: "", label: "Sin titular" },
        ...profesores.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellidos}` })),
        ...(datos.titular && curso.profesorTitularId && !profesores.some((p) => p.id === curso.profesorTitularId)
            ? [{ value: curso.profesorTitularId, label: `${datos.titular.nombre} ${datos.titular.apellidos} · inactivo` }]
            : []),
    ];

    return (
        <main className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
                <CursoHeader
                    nombre={curso.nombre}
                    estadoCurso={curso.estado}
                    titular={datos.titular}
                    totalEstudiantes={totalEstudiantes}
                    onEditar={abrirEdicion}
                    accionExtra={
                        <Button
                            variant="outline"
                            className="min-h-12"
                            onClick={() => setConfirmandoDuplicar(true)}
                            disabled={duplicando}
                        >
                            Duplicar al año siguiente
                        </Button>
                    }
                />

                {aviso ? (
                    <p
                        role={aviso.tipo === "error" ? "alert" : "status"}
                        className={`text-sm font-semibold ${aviso.tipo === "exito" ? "text-estado-pino" : "text-estado-ambar"}`}
                    >
                        {aviso.mensaje}
                    </p>
                ) : null}

                <div className="grid items-stretch gap-5 sm:gap-6 lg:grid-cols-[1fr_auto]">
                    <TarjetasCurso
                        alertas30d={datos.alertas30d}
                        delta30d={datos.delta30d}
                        identificadoresActivos={datos.identificadoresActivos}
                        coberturaPct={coberturaPct}
                        acudientesActivos={datos.acudientesActivos}
                    />
                    <section
                        aria-label="Anillos de protección del curso"
                        className="glass rounded-[var(--radio-card)] p-6 sm:p-8 flex items-center"
                    >
                        <AnilloCurso
                            vigilancia={datos.cobertura.vigilancia}
                            reaccion={datos.cobertura.reaccion}
                            estudiantes={totalEstudiantes}
                            sinRedes={datos.cobertura.sinRedes}
                            sinContacto={datos.cobertura.sinContacto}
                        />
                    </section>
                </div>

                {totalEstudiantes === 0 ? (
                    <EmptyState
                        title="Este curso aún no tiene estudiantes"
                        description="Agregue el primero para empezar a ver su cobertura y a quién llamar."
                        action={
                            <Button className="min-h-12" onClick={() => setAgregando(true)}>
                                + Agregar estudiante
                            </Button>
                        }
                    />
                ) : (
                    <section aria-label="Estudiantes del curso" className="glass rounded-[var(--radio-card)] p-6 sm:p-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="titular-seccion text-body">Estudiantes del curso</h2>
                            <Button className="min-h-12" onClick={() => setAgregando(true)}>
                                + Agregar estudiante
                            </Button>
                        </div>
                        <div className="mt-4">
                            <TablaEstudiantes
                                estudiantes={datos.estudiantes}
                                onToggleEstado={toggleEstadoEstudiante}
                                togglingId={togglingId}
                                onToggleObservacion={toggleObservacion}
                                togglingObservacionId={togglingObservacionId}
                            />
                        </div>
                    </section>
                )}

                <SeccionMateriasCurso cursoId={curso.id} onAviso={manejarAviso} />
            </div>

            <FormAgregarEstudiante
                cursoId={curso.id}
                isOpen={agregando}
                onClose={() => setAgregando(false)}
                onCreado={() => {
                    setAviso({ tipo: "exito", mensaje: "Estudiante agregado." });
                    router.refresh();
                }}
            />

            <Modal isOpen={confirmandoDuplicar} onClose={() => setConfirmandoDuplicar(false)} title="Duplicar curso">
                <div className="space-y-4">
                    <p className="text-body">
                        Se creará una copia de <strong>{curso.nombre}</strong> con todos sus estudiantes e identificadores activos para el año siguiente.
                    </p>
                    <p className="text-sm text-muted">El curso original no se modificará.</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={duplicarCurso} isLoading={duplicando} className="min-h-12">
                            Duplicar
                        </Button>
                        <Button variant="outline" className="min-h-12" onClick={() => setConfirmandoDuplicar(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={editando} onClose={() => setEditando(false)} title="Editar curso">
                <div className="space-y-4">
                    <Input
                        label="Nombre"
                        required
                        minLength={2}
                        maxLength={150}
                        value={editForm.nombre}
                        onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                    />
                    <Select
                        label="Grado"
                        options={GRADO_OPTIONS}
                        value={editForm.grado}
                        onChange={(e) => setEditForm({ ...editForm, grado: e.target.value })}
                    />
                    <Input
                        label="Año lectivo"
                        maxLength={20}
                        value={editForm.anioLectivo}
                        onChange={(e) => setEditForm({ ...editForm, anioLectivo: e.target.value })}
                    />
                    <Select
                        label="Profesor titular"
                        options={opcionesTitular}
                        value={editForm.profesorTitularId}
                        disabled={cargandoProfesores}
                        onChange={(e) => setEditForm({ ...editForm, profesorTitularId: e.target.value })}
                    />
                    {cargandoProfesores ? (
                        <p className="text-xs text-subtle">Cargando profesores de su colegio…</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={guardarEdicion} isLoading={guardando} className="min-h-12">
                            Guardar
                        </Button>
                        <Button variant="outline" className="min-h-12" onClick={() => setEditando(false)}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>
        </main>
    );
}

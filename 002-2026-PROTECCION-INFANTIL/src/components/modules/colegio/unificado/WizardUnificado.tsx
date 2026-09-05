"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { SeccionCurso } from "./SeccionCurso";
import { TablaEstudiantes } from "./TablaEstudiantes";
import { SeccionIdentificadores } from "./SeccionIdentificadores";
import {
    construirPayload,
    estudianteVacio,
    filasAEstudiantes,
    validarWizard,
    type CursoForm,
    type ErroresWizard,
    type EstudianteForm,
    type ModoEstudiantes,
    type ModoProfesor,
    type ProfesorNuevoForm,
} from "./tipos";
import type { FilaListaValidada } from "@/lib/colegio/unificado/validar-lista";

/**
 * SPEC-146 (T005, FR-001) — Wizard unificado curso + estudiantes +
 * identificadores (mockup §5.3): UNA pantalla con 3 secciones (Accordion),
 * indicador de pasos y "Guardar todo →" sticky que persiste TODO en una sola
 * llamada atómica (POST /api/colegio/cursos/unificado). Toast humano de éxito
 * (§4.8) y navegación a la vista del curso.
 */

interface WizardUnificadoProps {
    /** `?modo=excel` (redirect de la carga vieja): abre la sección 2 en modo Excel. */
    modoExcelInicial?: boolean;
}

interface Toast {
    tipo: "exito" | "error";
    mensaje: string;
}

const PASOS = ["Curso", "Estudiantes", "Identificadores"];

export function WizardUnificado({ modoExcelInicial = false }: WizardUnificadoProps) {
    const router = useRouter();
    const contadorClave = useRef(0);
    const nuevaClave = () => `est-${++contadorClave.current}`;

    const [curso, setCurso] = useState<CursoForm>({ nombre: "", grado: "", anioLectivo: "", profesorTitularId: "" });
    const [modoProfesor, setModoProfesor] = useState<ModoProfesor>("existente");
    const [profesorNuevo, setProfesorNuevo] = useState<ProfesorNuevoForm>({ nombre: "", apellidos: "" });
    const [estudiantes, setEstudiantes] = useState<EstudianteForm[]>([estudianteVacio("est-0")]);
    const [modoEstudiantes, setModoEstudiantes] = useState<ModoEstudiantes>(modoExcelInicial ? "excel" : "manual");
    const [abiertos, setAbiertos] = useState<string[]>(["curso", "estudiantes"]);
    const [errores, setErrores] = useState<ErroresWizard | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [toast, setToast] = useState<Toast | null>(null);

    function toggleSeccion(id: string) {
        setAbiertos((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
    }

    function importarFilas(filas: FilaListaValidada[]) {
        setEstudiantes(filasAEstudiantes(filas, nuevaClave));
        setModoEstudiantes("manual");
        setErrores(null);
    }

    async function guardar() {
        const encontrados = validarWizard(curso, estudiantes);
        if (encontrados) {
            setErrores(encontrados);
            setAbiertos((prev) => [...new Set([...prev, "curso", "estudiantes"])]);
            setToast({ tipo: "error", mensaje: "No pudimos guardar. Revise los campos marcados y volvemos a intentar." });
            return;
        }
        setErrores(null);
        setGuardando(true);
        setToast(null);
        try {
            const res = await fetch("/api/colegio/cursos/unificado", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(construirPayload(curso, modoProfesor, profesorNuevo, estudiantes)),
            });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setToast({ tipo: "error", mensaje: `No pudimos guardar. ${mensaje ?? "Inténtalo de nuevo."}` });
                return;
            }
            const creado = data as { curso: { id: string; nombre: string }; resumen: { estudiantesCreados: number } };
            // §4.8: toast de éxito humano y navegación a la vista del curso.
            setToast({
                tipo: "exito",
                mensaje: `¡Listo! Curso ${creado.curso.nombre} creado con ${creado.resumen.estudiantesCreados} estudiantes 🎉`,
            });
            const destino = `/dashboard/colegio/cursos/${creado.curso.id}`;
            setTimeout(() => router.push(destino), 800);
        } catch {
            setToast({ tipo: "error", mensaje: "No pudimos guardar. Error de red — inténtalo de nuevo." });
        } finally {
            setGuardando(false);
        }
    }

    const pasoCompleto = [
        curso.nombre.trim().length >= 2,
        estudiantes.some((e) => e.nombre.trim() && e.apellidos.trim()),
        estudiantes.some((e) => e.identificadores.some((id) => id.valor.trim())),
    ];

    return (
        <div className="min-h-screen bg-page pb-28">
            <main className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
                <Link href="/dashboard/colegio/cursos" className="ring-accent inline-flex min-h-12 items-center rounded-xl px-2 text-sm font-semibold text-accent hover:underline">
                    ← Volver
                </Link>
                <h1 className="titular-h1 mt-2 text-body">Nuevo curso</h1>

                {/* Indicador de pasos (mockup §5.3: ●──────●──────○) */}
                <ol aria-label="Progreso" className="mt-4 flex items-center gap-2 text-sm text-subtle">
                    {PASOS.map((paso, i) => (
                        <li key={paso} className="flex items-center gap-2">
                            {i > 0 ? <span aria-hidden="true" className="text-subtle">──────</span> : null}
                            <span aria-hidden="true" className={pasoCompleto[i] ? "text-estado-pino" : "text-subtle"}>
                                {pasoCompleto[i] ? "●" : "○"}
                            </span>
                            <span className={pasoCompleto[i] ? "font-semibold text-body" : ""}>{paso}</span>
                        </li>
                    ))}
                </ol>

                <Accordion
                    className="mt-6"
                    abiertos={abiertos}
                    onToggle={toggleSeccion}
                    secciones={[
                        {
                            id: "curso",
                            titulo: "1. Datos del curso",
                            contenido: (
                                <SeccionCurso
                                    curso={curso}
                                    onCursoChange={(c) => {
                                        setCurso(c);
                                        if (errores?.curso) setErrores({ estudiantes: errores.estudiantes });
                                    }}
                                    modoProfesor={modoProfesor}
                                    onModoProfesorChange={setModoProfesor}
                                    profesorNuevo={profesorNuevo}
                                    onProfesorNuevoChange={setProfesorNuevo}
                                    errorNombre={errores?.curso}
                                />
                            ),
                        },
                        {
                            id: "estudiantes",
                            titulo: "2. Estudiantes",
                            detalle: `${estudiantes.filter((e) => e.nombre.trim() || e.apellidos.trim()).length} agregados`,
                            contenido: (
                                <TablaEstudiantes
                                    estudiantes={estudiantes}
                                    onChange={setEstudiantes}
                                    errores={errores?.estudiantes ?? {}}
                                    modo={modoEstudiantes}
                                    onModoChange={setModoEstudiantes}
                                    onImportar={importarFilas}
                                    nuevaClave={nuevaClave}
                                />
                            ),
                        },
                        {
                            id: "identificadores",
                            titulo: "3. Identificadores digitales",
                            detalle: "opcional",
                            contenido: <SeccionIdentificadores estudiantes={estudiantes} onChange={setEstudiantes} />,
                        },
                    ]}
                />
            </main>

            {/* Barra sticky de guardado (mockup §5.3) */}
            <div className="glass-strong fixed inset-x-0 bottom-0 z-40 border-t border-tinta/10 px-4 py-3 sm:px-6">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                    <Button type="button" variant="ghost" className="min-h-12" onClick={() => router.push("/dashboard/colegio/cursos")}>
                        Cancelar
                    </Button>
                    <Button type="button" className="min-h-12" isLoading={guardando} onClick={() => void guardar()}>
                        Guardar todo →
                    </Button>
                </div>
            </div>

            {/* Toast §4.8: éxito verde (pino) con emoji sutil; error ámbar con motivo humano */}
            {toast ? (
                <div
                    role="status"
                    className={`glass-strong fixed bottom-20 right-4 z-50 max-w-sm rounded-2xl px-5 py-4 text-sm font-semibold shadow-lg ${
                        toast.tipo === "exito" ? "text-estado-pino" : "text-estado-ambar"
                    }`}
                >
                    {toast.mensaje}
                </div>
            ) : null}
        </div>
    );
}

export default WizardUnificado;

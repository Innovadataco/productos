"use client";

/**
 * SPEC-344 (A-69 · C1) — Paso 3 · Profesores del colegio.
 * SPEC-442 (I-307 · Jelkin vivo 04-09): el botón «Agregar profesor» abría
 * `/dashboard/colegio/profesores?crear=1` — **sacaba al rector del camino
 * y lo dejaba en el panel** (sin vuelta). Ahora el formulario vive dentro
 * del paso: el rector NO se muda a otra pantalla a mitad de recorrido.
 *
 * Voz: usted formal Colombia (brief §0).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CampoCorreoDominio } from "@/components/modules/CampoCorreoDominio";
import { Select } from "@/components/ui/Select";
import { SelectorAnioNacimiento } from "@/components/ui/SelectorAnioNacimiento";
import { rangoAnioNacimientoAdulto } from "@/lib/identidad/anio-nacimiento";
import { Alerta } from "@/components/ui/Alerta";
import { CargaProfesoresExcel } from "@/components/modules/colegio/CargaProfesoresExcel";

interface ProfesorItem {
    id: string;
    nombre: string;
    apellidos: string;
    numeroDocumento: string;
    estado: string;
}

interface TipoDoc { clave: string; etiqueta: string }

// SPEC-954: rango desde la fuente única `@/lib/identidad/anio-nacimiento`
// (antes se duplicaba el IIFE acá). La red de seguridad del cliente lo sigue
// usando; el control de la UI es `SelectorAnioNacimiento`.
const RANGO_ANIO_NACIMIENTO = rangoAnioNacimientoAdulto();

const SEXO_OPTIONS = [
    { value: "", label: "Elija…" },
    { value: "M", label: "Masculino" },
    { value: "F", label: "Femenino" },
    { value: "OTRO", label: "Otro" },
];

const FORM_VACIO = {
    nombre: "",
    apellidos: "",
    tipoDocumento: "",
    numeroDocumento: "",
    anioNacimiento: "",
    sexo: "",
    email: "",
    telefono: "",
};

export default function PasoProfesoresColegio() {
    const router = useRouter();
    const [profesores, setProfesores] = useState<ProfesorItem[]>([]);
    const [tipos, setTipos] = useState<TipoDoc[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [enviando, setEnviando] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    // SPEC-958 (M5a): dominio del colegio para el 1.er chip del correo del profesor.
    const [dominioInstitucional, setDominioInstitucional] = useState<string | null>(null);

    const cargarProfesores = async () => {
        setCargando(true);
        try {
            const res = await fetch("/api/colegio/profesores?estado=activo", { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos cargar la lista de profesores.");
            const json = await res.json();
            setProfesores(json.items ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error cargando profesores.");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        void cargarProfesores();
        // SPEC-958 (M5a): dominio institucional del colegio (del correo del rector, si no
        // es genérico) para ofrecerlo como 1.er chip. Best-effort: si falla, el campo
        // queda con comunes + «Otro».
        fetch("/api/colegio/dominio-institucional", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => setDominioInstitucional(json?.dominioInstitucional ?? null))
            .catch(() => null);
        fetch("/api/colegio/tipos-documento", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => {
                const filas: unknown = json?.items ?? json?.data ?? json ?? [];
                if (Array.isArray(filas)) {
                    setTipos(
                        filas
                            .filter((f): f is { clave: string; etiqueta?: string; nombre?: string } => typeof f === "object" && f !== null && "clave" in f)
                            .map((f) => ({ clave: String(f.clave), etiqueta: String(f.etiqueta ?? f.nombre ?? f.clave) })),
                    );
                }
            })
            .catch(() => null);
    }, []);

    const agregar = async () => {
        setFormError(null);
        const nombre = form.nombre.trim();
        const apellidos = form.apellidos.trim();
        const numeroDocumento = form.numeroDocumento.trim();
        const email = form.email.trim();
        const telefono = form.telefono.trim();
        if (!nombre || !apellidos || !form.tipoDocumento || !numeroDocumento || !form.anioNacimiento.trim() || !form.sexo || !email || !telefono) {
            setFormError("Complete todos los campos del profesor.");
            return;
        }
        const anio = Number(form.anioNacimiento);
        const { minAnio, maxAnio } = RANGO_ANIO_NACIMIENTO;
        if (!Number.isInteger(anio) || anio < minAnio || anio > maxAnio) {
            setFormError(`Año de nacimiento fuera de rango (${minAnio}–${maxAnio}).`);
            return;
        }
        setEnviando(true);
        try {
            const res = await fetch("/api/colegio/profesores", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre,
                    apellidos,
                    tipoDocumento: form.tipoDocumento,
                    numeroDocumento,
                    anioNacimiento: anio,
                    sexo: form.sexo,
                    email,
                    telefono,
                }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error?.message || "No pudimos agregar al profesor.");
            }
            setForm(FORM_VACIO);
            await cargarProfesores();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Error agregando profesor.");
        } finally {
            setEnviando(false);
        }
    };

    const continuar = () => router.push("/camino/colegio/cursos");
    const atras = () => router.push("/camino/colegio/plan");
    const listo = profesores.some((p) => p.estado === "activo") || profesores.length > 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">Primero, quiénes enseñan.</h1>
                <p className="mt-2 text-sm text-muted">
                    Sus cuentas también se vigilan: si alguien reporta el usuario de un profesor, usted se entera.
                </p>
            </div>

            <GlassCard>
                <h2 className="font-semibold text-body">Lista actual</h2>
                {cargando ? (
                    <p className="mt-2 text-sm text-muted">Cargando…</p>
                ) : profesores.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">Aún no ha agregado profesores.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-tinta/10">
                        {profesores.map((p) => (
                            <li key={p.id} className="py-2 text-sm text-body">
                                {p.nombre} {p.apellidos}
                                <span className="ml-2 text-xs text-muted">· {p.numeroDocumento}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </GlassCard>

            {/* SPEC-442: agregar profesor SIN salir del camino. */}
            <GlassCard>
                <h2 className="font-semibold text-body">Agregar un profesor</h2>
                {/* SPEC-957 (B.2): aviso de tranquilidad VISIBLE (antes era text-xs muted y
                    se perdía). Tono informativo, no alarma — «no tiene que cargarlos todos
                    ahora». Copy de Diseño (FORMA-ONBOARDING §B.2). */}
                <div className="mt-3">
                    <Alerta tono="info">
                        No tiene que cargarlos todos ahora. Sume los que quiera y, al terminar el camino, agregue o edite el resto desde el panel.
                    </Alerta>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                        label="Nombres"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                    <Input
                        label="Apellidos"
                        value={form.apellidos}
                        onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                    />
                    <div className="flex flex-col gap-1">
                        <label htmlFor="profTipoDoc" className="text-xs font-medium text-muted">Tipo de documento</label>
                        <select
                            id="profTipoDoc"
                            value={form.tipoDocumento}
                            onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value })}
                            className="rounded-xl border border-tinta/10 bg-white px-3 py-2 text-sm dark:bg-tinta/5"
                        >
                            <option value="">Elija</option>
                            {tipos.map((t) => (
                                <option key={t.clave} value={t.clave}>{t.etiqueta}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="Número"
                        value={form.numeroDocumento}
                        onChange={(e) => setForm({ ...form, numeroDocumento: e.target.value })}
                    />
                    <SelectorAnioNacimiento
                        value={form.anioNacimiento}
                        onChange={(anio) => setForm({ ...form, anioNacimiento: anio })}
                    />
                    <Select
                        label="Sexo"
                        options={SEXO_OPTIONS}
                        value={form.sexo}
                        onChange={(e) => setForm({ ...form, sexo: e.target.value })}
                    />
                    {/* SPEC-958 (M5a): campo de correo partido [usuario]@[dominio] con el
                        dominio del colegio como 1.ª opción, preseleccionado para el profesor. */}
                    <div className="sm:col-span-2">
                        <CampoCorreoDominio
                            label="Email"
                            value={form.email}
                            onChange={(email) => setForm({ ...form, email })}
                            dominioInstitucional={dominioInstitucional}
                            preseleccionarInstitucional
                        />
                    </div>
                    <Input
                        label="Teléfono"
                        value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                </div>
                {formError && (
                    <Alerta tono="advertencia" className="mt-3">{formError}</Alerta>
                )}
                <div className="mt-3 flex justify-end">
                    <Button onClick={agregar} isLoading={enviando}>Agregar</Button>
                </div>
            </GlassCard>

            <CargaProfesoresExcel
                titulo="O cargue una lista desde Excel/CSV"
                onCompletado={cargarProfesores}
            />

            {error && <Alerta tono="advertencia">{error}</Alerta>}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button onClick={continuar} disabled={!listo} className="w-full sm:flex-1">
                    Continuar
                </Button>
                <button
                    type="button"
                    onClick={atras}
                    className="w-full rounded-xl border border-tinta/20 px-4 py-2 text-sm font-medium text-muted hover:border-pino hover:text-pino sm:w-auto"
                >
                    Atrás
                </button>
            </div>
        </div>
    );
}

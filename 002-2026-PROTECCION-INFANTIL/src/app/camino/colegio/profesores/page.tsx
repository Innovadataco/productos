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
import { Select } from "@/components/ui/Select";
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

// SPEC-442: mismo rango que `ProfesoresPageClient.RANGO_ANIO_NACIMIENTO`
// (18 a 80 años). Duplicación mínima intencional — el paso vive en un árbol
// separado y no queremos importar la clase entera del panel.
const RANGO_ANIO_NACIMIENTO = (() => {
    const ahora = new Date().getFullYear();
    return { minAnio: ahora - 80, maxAnio: ahora - 18 };
})();

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
                <p className="mt-1 text-xs text-muted">
                    Puede agregar varios; al terminar el camino los edita desde el panel.
                </p>
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
                    <Input
                        label="Año de nacimiento"
                        type="number"
                        min={RANGO_ANIO_NACIMIENTO.minAnio}
                        max={RANGO_ANIO_NACIMIENTO.maxAnio}
                        step={1}
                        placeholder={`${RANGO_ANIO_NACIMIENTO.minAnio}–${RANGO_ANIO_NACIMIENTO.maxAnio}`}
                        value={form.anioNacimiento}
                        onChange={(e) => setForm({ ...form, anioNacimiento: e.target.value })}
                    />
                    <Select
                        label="Sexo"
                        options={SEXO_OPTIONS}
                        value={form.sexo}
                        onChange={(e) => setForm({ ...form, sexo: e.target.value })}
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
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

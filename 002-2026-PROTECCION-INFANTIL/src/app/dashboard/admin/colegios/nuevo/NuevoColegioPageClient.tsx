"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { calcularFinServicio } from "@/lib/colegio/periodo";

type Pais = { id: string; nombre: string; codigo?: string };
type Departamento = { id: string; nombre: string; paisId?: string };

type TipoPeriodo = "MENSUAL" | "SEMESTRAL" | "ANUAL" | "LIBRE";

const initialForm = {
    nombre: "",
    paisId: "",
    departamentoId: "",
    ciudadId: "",
    direccion: "",
    representanteLegalNombre: "",
    representanteLegalIdentificacion: "",
    representanteLegalEmail: "",
    representanteLegalTelefono: "",
    inicioServicio: "",
    finServicio: "",
    tipoPeriodo: "MENSUAL" as TipoPeriodo,
    adminEmail: "",
    adminNombre: "",
};

type FormState = typeof initialForm;

type Mensaje = { type: "success" | "error"; text: string } | null;

function toISOString(datetimeLocal: string) {
    if (!datetimeLocal) return undefined;
    try {
        return new Date(datetimeLocal).toISOString();
    } catch {
        return undefined;
    }
}

export default function NuevoColegioPageClient() {
    const router = useRouter();
    const [form, setForm] = useState<FormState>(initialForm);
    const [paises, setPaises] = useState<Pais[]>([]);
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [ciudadSel, setCiudadSel] = useState<CiudadOpcion | null>(null);
    const [loadingPaises, setLoadingPaises] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<Mensaje>(null);
    const [success, setSuccess] = useState<Mensaje>(null);
    const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);

    useEffect(() => {
        setLoadingPaises(true);
        fetch("/api/paises", { credentials: "include" })
            .then((r) => r.json().catch(() => ({})))
            .then((data) => setPaises(data.paises || []))
            .catch(() => setError({ type: "error", text: "Error cargando países" }))
            .finally(() => setLoadingPaises(false));
    }, []);

    useEffect(() => {
        if (!form.paisId) return;
        fetch(`/api/departamentos?paisId=${encodeURIComponent(form.paisId)}`, { credentials: "include" })
            .then((r) => r.json().catch(() => ({})))
            .then((data) => setDepartamentos(data.departamentos || []))
            .catch(() => setError({ type: "error", text: "Error cargando departamentos" }));
    }, [form.paisId]);

    // SPEC-115: la ciudad se elige con buscador en servidor (CiudadSearchSelect);
    // ya no se descarga la lista completa de ciudades del país/departamento.
    function update<K extends keyof FormState>(field: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [field]: value }) as FormState);
    }

    function onPaisChange(paisId: string) {
        setDepartamentos([]);
        setCiudadSel(null);
        setForm((prev) => ({ ...prev, paisId, departamentoId: "", ciudadId: "" }));
    }

    function onDepartamentoChange(departamentoId: string) {
        setCiudadSel(null);
        setForm((prev) => ({ ...prev, departamentoId, ciudadId: "" }));
    }

    function onCiudadSelect(opcion: CiudadOpcion | null) {
        setCiudadSel(opcion);
        setForm((prev) => ({ ...prev, ciudadId: opcion?.id ?? "" }));
    }

    const esPeriodoLibre = form.tipoPeriodo === "LIBRE";
    const finCalculado =
        !esPeriodoLibre && form.inicioServicio
            ? calcularFinServicio(new Date(form.inicioServicio), form.tipoPeriodo)
            : null;

    function validate() {
        const required: (keyof FormState)[] = [
            "nombre",
            "paisId",
            "ciudadId",
            "representanteLegalNombre",
            "representanteLegalIdentificacion",
            "representanteLegalEmail",
            "inicioServicio",
            "tipoPeriodo",
            "adminEmail",
            "adminNombre",
        ];
        for (const key of required) {
            const value = form[key];
            if (typeof value === "string" && value.trim() === "") {
                return "Completa todos los campos requeridos";
            }
        }
        if (esPeriodoLibre) {
            if (!form.finServicio) {
                return "Completa la fecha de fin del servicio";
            }
            if (form.finServicio <= form.inicioServicio) {
                return "La fecha de fin debe ser posterior al inicio";
            }
        }
        return null;
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const validationError = validate();
        if (validationError) {
            setError({ type: "error", text: validationError });
            setSuccess(null);
            return;
        }
        setSaving(true);
        setError(null);
        setSuccess(null);
        setPasswordTemporal(null);
        try {
            const res = await fetch("/api/admin/colegios", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: form.nombre,
                    paisId: form.paisId,
                    departamentoId: form.departamentoId || undefined,
                    ciudadId: form.ciudadId,
                    direccion: form.direccion || undefined,
                    representanteLegalNombre: form.representanteLegalNombre,
                    representanteLegalIdentificacion: form.representanteLegalIdentificacion,
                    representanteLegalEmail: form.representanteLegalEmail,
                    representanteLegalTelefono: form.representanteLegalTelefono || undefined,
                    inicioServicio: toISOString(form.inicioServicio),
                    finServicio: esPeriodoLibre
                        ? toISOString(form.finServicio)
                        : finCalculado?.toISOString(),
                    tipoPeriodo: form.tipoPeriodo,
                    adminEmail: form.adminEmail,
                    adminNombre: form.adminNombre,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setSuccess({ type: "success", text: data.mensaje || "Colegio creado correctamente" });
                setPasswordTemporal(data.passwordTemporal || null);
                setForm(initialForm);
                setCiudadSel(null);
            } else {
                setError({ type: "error", text: data?.error?.message || "Error creando colegio" });
            }
        } catch {
            setError({ type: "error", text: "Error de red creando colegio" });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Nuevo colegio</h1>
                <p className="text-sm text-muted">
                    Crea una institución educativa y su administrador institucional. Se genera una contraseña temporal.
                </p>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {error.text}
                </div>
            )}

            {success && (
                <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                    {success.text}
                </div>
            )}

            {passwordTemporal && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-semibold">Contraseña temporal del administrador institucional</p>
                    <p className="mt-1 opacity-80">Muéstrela una vez; no se volverá a mostrar.</p>
                    <div className="mt-3 flex items-center gap-3">
                        <code className="rounded-lg bg-white/60 px-3 py-1.5 font-mono text-base dark:bg-slate-900/60">
                            {passwordTemporal}
                        </code>
                        <Button
                            type="button"
                            variant="outline"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => navigator.clipboard.writeText(passwordTemporal)}
                        >
                            Copiar
                        </Button>
                    </div>
                    <div className="mt-4">
                        <Button onClick={() => router.push("/dashboard/admin/colegios")}>
                            Volver al listado
                        </Button>
                    </div>
                </div>
            )}

            <GlassCard>
                <form onSubmit={submit} className="space-y-6">
                    <section className="space-y-4">
                        <h2 className="text-lg font-semibold text-body">Información de la institución</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre del colegio"
                                required
                                value={form.nombre}
                                onChange={(e) => update("nombre", e.target.value)}
                            />
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-body">
                                    País <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={form.paisId}
                                    onChange={(e) => onPaisChange(e.target.value)}
                                    className="w-full rounded-xl px-4 py-3 text-sm text-body glass-input ring-accent-input"
                                    disabled={loadingPaises}
                                >
                                    <option value="">{loadingPaises ? "Cargando..." : "Selecciona país"}</option>
                                    {paises.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-body">Departamento</label>
                                <select
                                    value={form.departamentoId}
                                    onChange={(e) => onDepartamentoChange(e.target.value)}
                                    className="w-full rounded-xl px-4 py-3 text-sm text-body glass-input ring-accent-input"
                                    disabled={!form.paisId}
                                >
                                    <option value="">
                                        {form.paisId ? "Todos los departamentos" : "Selecciona país primero"}
                                    </option>
                                    {departamentos.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <CiudadSearchSelect
                                    label="Ciudad *"
                                    paisId={form.paisId}
                                    departamentoId={form.departamentoId || undefined}
                                    value={ciudadSel}
                                    onSelect={onCiudadSelect}
                                    disabled={!form.paisId}
                                    placeholder={form.paisId ? "Escribe la ciudad" : "Selecciona país primero"}
                                />
                            </div>
                            <Input
                                label="Dirección"
                                value={form.direccion}
                                onChange={(e) => update("direccion", e.target.value)}
                            />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-lg font-semibold text-body">Representante legal</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre completo"
                                required
                                value={form.representanteLegalNombre}
                                onChange={(e) => update("representanteLegalNombre", e.target.value)}
                            />
                            <Input
                                label="Identificación"
                                required
                                value={form.representanteLegalIdentificacion}
                                onChange={(e) => update("representanteLegalIdentificacion", e.target.value)}
                            />
                            <Input
                                label="Email"
                                type="email"
                                required
                                value={form.representanteLegalEmail}
                                onChange={(e) => update("representanteLegalEmail", e.target.value)}
                            />
                            <Input
                                label="Teléfono"
                                value={form.representanteLegalTelefono}
                                onChange={(e) => update("representanteLegalTelefono", e.target.value)}
                            />
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-lg font-semibold text-body">Vigencia del servicio</h2>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-body">
                                    Tipo de período <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={form.tipoPeriodo}
                                    onChange={(e) => update("tipoPeriodo", e.target.value as TipoPeriodo)}
                                    className="w-full rounded-xl px-4 py-3 text-sm text-body glass-input ring-accent-input"
                                >
                                    <option value="MENSUAL">Mensual</option>
                                    <option value="SEMESTRAL">Semestral</option>
                                    <option value="ANUAL">Anual</option>
                                    <option value="LIBRE">Libre (fechas manuales)</option>
                                </select>
                            </div>
                            <Input
                                label="Inicio del servicio"
                                type="datetime-local"
                                required
                                value={form.inicioServicio}
                                onChange={(e) => update("inicioServicio", e.target.value)}
                            />
                            {esPeriodoLibre ? (
                                <Input
                                    label="Fin del servicio"
                                    type="datetime-local"
                                    required
                                    min={form.inicioServicio || undefined}
                                    value={form.finServicio}
                                    onChange={(e) => update("finServicio", e.target.value)}
                                />
                            ) : (
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-body">Fin del servicio</label>
                                    <div className="w-full rounded-xl px-4 py-3 text-sm text-muted glass-input">
                                        {finCalculado
                                            ? `Se calcula automáticamente: ${finCalculado.toLocaleDateString("es-CO")}`
                                            : "Se calcula automáticamente al elegir el inicio"}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-lg font-semibold text-body">Administrador institucional</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre del administrador"
                                required
                                value={form.adminNombre}
                                onChange={(e) => update("adminNombre", e.target.value)}
                            />
                            <Input
                                label="Email del administrador"
                                type="email"
                                required
                                value={form.adminEmail}
                                onChange={(e) => update("adminEmail", e.target.value)}
                            />
                        </div>
                    </section>

                    <div className="flex flex-wrap gap-3 pt-2">
                        <Button type="submit" isLoading={saving}>
                            Crear colegio
                        </Button>
                        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/admin/colegios")}>
                            Cancelar
                        </Button>
                    </div>
                </form>
            </GlassCard>
        </div>
    );
}

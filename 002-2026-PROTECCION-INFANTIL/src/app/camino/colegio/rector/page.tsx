"use client";

/**
 * SPEC-344 (A-69 · C1) — Paso 1 del camino del colegio · Quien responde.
 *
 * El rector completa 5 campos (tipo/número doc, nombres, apellidos, teléfono)
 * y acepta el Convenio Institucional (v1.0 público de SPEC-343). Con estos
 * datos el informe que firme ante una autoridad tiene validez.
 *
 * Voz: usted formal Colombia (brief §0).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";

interface TipoDoc {
    clave: string;
    etiqueta: string;
}

export default function PasoRectorColegio() {
    const router = useRouter();
    const [tipos, setTipos] = useState<TipoDoc[]>([]);
    const [datos, setDatos] = useState({
        documentoTipo: "",
        documentoNumero: "",
        nombre: "",
        apellidos: "",
        telefono: "",
    });
    const [error, setError] = useState<string | null>(null);
    const [campoError, setCampoError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
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
            .catch(() => {
                // Ignorar; el usuario puede reintentar o dejar el campo vacío.
            });
    }, []);

    const todosLlenos =
        datos.documentoTipo &&
        datos.documentoNumero.trim() &&
        datos.nombre.trim() &&
        datos.apellidos.trim() &&
        datos.telefono.trim();
    const listo = Boolean(todosLlenos);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!listo) return;
        setError(null);
        setCampoError(null);
        setEnviando(true);
        try {
            // 1) Guardar el rector (5 campos).
            const resRector = await fetch("/api/colegio/rector", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datos),
            });
            if (!resRector.ok) {
                const json = await resRector.json().catch(() => null);
                setCampoError(json?.error?.campo ?? null);
                throw new Error(json?.error?.message || "No pudimos guardar sus datos. Intente de nuevo.");
            }
            // El convenio ya lo aceptó en /consentimiento (guardián de
            // consentimiento corre antes del guardián del camino). El Paso 1
            // del camino se enfoca en los 5 campos del rector.
            router.push("/camino/colegio/plan");
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos continuar. Intente de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">Cuéntenos quién responde por el colegio.</h1>
                <p className="mt-2 text-sm text-muted">
                    Con estos datos el informe que usted firme tiene validez ante una autoridad.
                </p>
            </div>

            <GlassCard>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1">
                            <label htmlFor="tipoDoc" className="text-xs font-medium text-muted">Tipo de documento</label>
                            <select
                                id="tipoDoc"
                                value={datos.documentoTipo}
                                onChange={(e) => setDatos({ ...datos, documentoTipo: e.target.value })}
                                className={`rounded-xl border px-3 py-2 text-sm ${campoError === "documentoTipo" ? "border-ambar" : "border-tinta/10"}`}
                            >
                                <option value="">Elija</option>
                                {tipos.map((t) => (
                                    <option key={t.clave} value={t.clave}>
                                        {t.etiqueta}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Input
                            label="Número"
                            value={datos.documentoNumero}
                            onChange={(e) => setDatos({ ...datos, documentoNumero: e.target.value })}
                        />
                        <Input
                            label="Teléfono"
                            value={datos.telefono}
                            onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                            placeholder="+57 310 442 8890"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                            label="Nombres"
                            value={datos.nombre}
                            onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
                        />
                        <Input
                            label="Apellidos"
                            value={datos.apellidos}
                            onChange={(e) => setDatos({ ...datos, apellidos: e.target.value })}
                        />
                    </div>

                    {error && (
                        <Alerta tono="advertencia" className="text-center">
                            {error}
                        </Alerta>
                    )}
                    <Button type="submit" isLoading={enviando} disabled={!listo} className="w-full">
                        Continuar
                    </Button>
                </form>
            </GlassCard>
        </div>
    );
}

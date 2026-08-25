"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { InvitacionEnviadaModal } from "@/components/modules/InvitacionEnviadaModal";

type Mensaje = { type: "success" | "error"; text: string } | null;

interface FormState {
    nombreColegio: string;
    nombreRector: string;
    emailRector: string;
}

const initialForm: FormState = {
    nombreColegio: "",
    nombreRector: "",
    emailRector: "",
};

function validate(form: FormState): string | null {
    if (!form.nombreColegio.trim()) return "El nombre del colegio es requerido";
    if (!form.nombreRector.trim()) return "El nombre del rector es requerido";
    if (!form.emailRector.trim()) return "El email del rector es requerido";
    if (!form.emailRector.includes("@")) return "El email del rector no es válido";
    return null;
}

export default function NuevoColegioPageClient() {
    const router = useRouter();
    const [form, setForm] = useState<FormState>(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<Mensaje>(null);
    const [modalOpen, setModalOpen] = useState(false);

    function update<K extends keyof FormState>(field: K, value: FormState[K]) {
        setForm((prev: FormState) => ({ ...prev, [field]: value }));
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const validationError = validate(form);
        if (validationError) {
            setError({ type: "error", text: validationError });
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/colegios", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: form.nombreColegio,
                    nombreRector: form.nombreRector,
                    emailRector: form.emailRector,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setForm(initialForm);
                setModalOpen(true);
            } else {
                setError({ type: "error", text: data?.error?.message || "Error creando colegio" });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error de red creando colegio";
            setError({ type: "error", text: message });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Nuevo colegio</h1>
                <p className="text-sm text-muted">
                    Envía una invitación al rector para activar la cuenta de su institución.
                </p>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {error.text}
                </div>
            )}

            <GlassCard>
                <form onSubmit={submit} className="space-y-6">
                    <section className="space-y-4">
                        <h2 className="text-lg font-semibold text-body">Datos de la institución</h2>
                        <Input
                            label="Nombre del colegio"
                            required
                            value={form.nombreColegio}
                            onChange={(e) => update("nombreColegio", e.target.value)}
                        />
                        <Input
                            label="Nombre del rector"
                            required
                            value={form.nombreRector}
                            onChange={(e) => update("nombreRector", e.target.value)}
                        />
                        <Input
                            label="Email del rector"
                            type="email"
                            required
                            value={form.emailRector}
                            onChange={(e) => update("emailRector", e.target.value)}
                        />
                    </section>

                    <div className="flex flex-wrap gap-3 pt-2">
                        <Button type="submit" isLoading={saving}>
                            Enviar invitación
                        </Button>
                        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/admin/colegios")}>
                            Cancelar
                        </Button>
                    </div>
                </form>
            </GlassCard>

            <InvitacionEnviadaModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
    );
}

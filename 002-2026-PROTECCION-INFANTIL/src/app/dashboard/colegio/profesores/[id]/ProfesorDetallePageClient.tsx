"use client";

import { useEffect, useState } from "react";
import { SkeletonLista } from "@/components/ui/skeletons";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import {
    IdentificadoresParaAlertas,
    type ApiIdentificadores,
    type DatosIdentificador,
    type IdentificadorAlerta,
} from "@/components/modules/colegio/identificadores/IdentificadoresParaAlertas";

type Profesor = {
    id: string;
    nombre: string;
    apellidos: string;
    email: string | null;
    telefono: string | null;
    estado: string;
};

export default function ProfesorDetallePageClient({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const [profesorId, setProfesorId] = useState<string | null>(null);
    const [profesor, setProfesor] = useState<Profesor | null>(null);
    const [identificadores, setIdentificadores] = useState<IdentificadorAlerta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        params.then((p) => {
            setProfesorId(p.id);
            cargar(p.id);
        });
    }, [params]);

    // SPEC-932: recarga SOLO los identificadores, sin pasar a skeleton — el componente no se desmonta y conserva
    // su mensaje de éxito tras guardar.
    async function recargarIdentificadores(id: string) {
        try {
            const res = await fetch(`/api/colegio/profesores/${id}/identificadores`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) setIdentificadores(data.identificadores || []);
        } catch {
            // la próxima carga completa lo reintenta; el guardado ya se confirmó en el componente
        }
    }

    async function cargar(id: string) {
        setLoading(true);
        setError("");
        try {
            const [resProfesor, resIdentificadores] = await Promise.all([
                fetch(`/api/colegio/profesores/${id}`, { credentials: "include" }),
                fetch(`/api/colegio/profesores/${id}/identificadores`, { credentials: "include" }),
            ]);
            const dataProfesor = await resProfesor.json().catch(() => ({}));
            const dataIdentificadores = await resIdentificadores.json().catch(() => ({}));

            if (resProfesor.ok && dataProfesor.profesor) {
                setProfesor(dataProfesor.profesor);
            } else if (resProfesor.status === 404 || resProfesor.status === 403) {
                setError(dataProfesor?.error?.message || "No tiene acceso a este profesor");
                setLoading(false);
                return;
            }

            if (resIdentificadores.ok) {
                setIdentificadores(dataIdentificadores.identificadores || []);
            }
        } catch {
            setError("Error de red cargando el profesor");
        } finally {
            setLoading(false);
        }
    }

    // SPEC-932 · adaptador del profesor. El alta NO acepta `plataformaId: null` (se omite); la edición sí (limpia).
    function cuerpoProfesor(d: DatosIdentificador, edicion: boolean): Record<string, unknown> {
        return {
            valor: d.valor,
            ...(d.plataformaId ? { plataformaId: d.plataformaId } : edicion ? { plataformaId: null } : {}),
            ...(d.confirmarCompartido ? { confirmarCompartido: true } : {}),
        };
    }
    const enviar = (url: string, method: "POST" | "PATCH", body: unknown) =>
        fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const apiIdentificadores: ApiIdentificadores = {
        crear: (d) => enviar(`/api/colegio/profesores/${profesorId}/identificadores`, "POST", cuerpoProfesor(d, false)),
        editar: (i, d) => enviar(`/api/colegio/identificadores-profesor/${i.id}`, "PATCH", cuerpoProfesor(d, true)),
        cambiarEstado: (i, estado) => enviar(`/api/colegio/identificadores-profesor/${i.id}/estado`, "PATCH", estado),
    };

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Button variant="outline" onClick={() => router.push("/dashboard/colegio/profesores")} className="mb-2">
                                ← Volver a profesores
                            </Button>
                            <h1 className="text-2xl font-bold text-body">
                                {profesor ? `${profesor.nombre} ${profesor.apellidos}` : "Profesor"}
                            </h1>
                            {profesor?.estado && (
                                <Badge variant={profesor.estado === "activo" ? "success" : "neutral"} className="mt-2">
                                    {profesor.estado === "activo" ? "Activo" : "Inactivo"}
                                </Badge>
                            )}
                        </div>
                    </div>


                    {loading ? (
                        <SkeletonLista />
                    ) : error ? (
                        <ErrorState title="No pudimos cargar el profesor" description={error} onRetry={() => profesorId && cargar(profesorId)} />
                    ) : profesor ? (
                        <>
                            <GlassCard>
                                <h2 className="text-lg font-semibold text-body">Contacto</h2>
                                <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                    <p>
                                        <span className="text-muted">Email:</span>{" "}
                                        {profesor.email || "—"}
                                    </p>
                                    <p>
                                        <span className="text-muted">Teléfono:</span>{" "}
                                        {profesor.telefono || "—"}
                                    </p>
                                </div>
                            </GlassCard>

                            {/* SPEC-932: el patrón ÚNICO (canon de la FORMA SPEC-931 §1), compartido por los 4 sujetos. */}
                            <IdentificadoresParaAlertas
                                identificadores={identificadores}
                                api={apiIdentificadores}
                                onCambio={() => (profesorId ? recargarIdentificadores(profesorId) : undefined)}
                            />
                        </>
                    ) : null}
                </div>
            </main>
        </div>
    );
}

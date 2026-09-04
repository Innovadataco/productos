"use client";

/**
 * SPEC-391 (A-75 · L1b) — el profesional recién creado completa su perfil.
 *
 * Estado inicial: `BORRADOR`. Cuando el profesional guarda con todo lleno Y
 * sube la autorización firmada, el backend transiciona a `EN_REVISION` — de
 * ahí lo toma L2 (IDC). Mientras esté en `BORRADOR`, nada aparece en la cola
 * de admin y nada aparece en el directorio del padre.
 *
 * La subida de la autorización es un `multipart/form-data` propio: PDF, PNG o
 * JPG (foto del documento con el teléfono), tope 5 MB, validación por magia
 * de bytes. El servidor devuelve error legible si el formato no es aceptado.
 */
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";

type Perfil = {
    id: string;
    nombreVisible: string;
    tituloProfesional: string;
    especialidades: string[];
    ciudad: { id: string; nombre: string };
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    aniosExperiencia: number;
    presentacion: string;
    tarifaConsultaCOP: number;
    duracionMinutos: number;
    emiteFactura: boolean;
    estado: string;
    autorizacionSubida: boolean;
};

export default function CompletarPerfilProfesionalPage() {
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [cargando, setCargando] = useState(true);
    const [nombreVisible, setNombreVisible] = useState("");
    const [tituloProfesional, setTituloProfesional] = useState("");
    const [especialidadesTexto, setEspecialidadesTexto] = useState("");
    const [ciudadId, setCiudadId] = useState("");
    const [atiendeVirtual, setAtiendeVirtual] = useState(false);
    const [atiendePresencial, setAtiendePresencial] = useState(false);
    const [aniosExperiencia, setAniosExperiencia] = useState<number>(0);
    const [presentacion, setPresentacion] = useState("");
    const [tarifaConsultaCOP, setTarifaConsultaCOP] = useState<number>(0);
    const [duracionMinutos, setDuracionMinutos] = useState<number>(45);
    const [emiteFactura, setEmiteFactura] = useState(false);
    const [numeroTarjetaProfesional, setNumeroTarjeta] = useState("");
    const [archivo, setArchivo] = useState<File | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [errorPerfil, setErrorPerfil] = useState("");
    const [errorArchivo, setErrorArchivo] = useState("");
    const [ok, setOk] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/profesional/perfil", { credentials: "include" });
                if (res.ok) {
                    const json = await res.json();
                    if (json.perfil) {
                        const p: Perfil = json.perfil;
                        setPerfil(p);
                        setNombreVisible(p.nombreVisible);
                        setTituloProfesional(p.tituloProfesional);
                        setEspecialidadesTexto(p.especialidades.join(", "));
                        setCiudadId(p.ciudad.id);
                        setAtiendeVirtual(p.atiendeVirtual);
                        setAtiendePresencial(p.atiendePresencial);
                        setAniosExperiencia(p.aniosExperiencia);
                        setPresentacion(p.presentacion);
                        setTarifaConsultaCOP(p.tarifaConsultaCOP);
                        setDuracionMinutos(p.duracionMinutos);
                        setEmiteFactura(p.emiteFactura);
                    }
                }
            } finally {
                setCargando(false);
            }
        })();
    }, []);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorPerfil("");
        setOk("");
        setGuardando(true);
        try {
            const especialidades = especialidadesTexto
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            const res = await fetch("/api/profesional/perfil", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombreVisible,
                    tituloProfesional,
                    especialidades,
                    ciudadId,
                    atiendeVirtual,
                    atiendePresencial,
                    aniosExperiencia,
                    presentacion,
                    tarifaConsultaCOP,
                    duracionMinutos,
                    emiteFactura,
                    numeroTarjetaProfesional: numeroTarjetaProfesional || null,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorPerfil(json?.error?.message ?? "No pudimos guardar el perfil.");
                return;
            }
            setPerfil(json.perfil as Perfil);
            setOk("Guardado.");
        } finally {
            setGuardando(false);
        }
    };

    const subirAutorizacion = async () => {
        if (!archivo) return;
        setErrorArchivo("");
        setSubiendo(true);
        try {
            const form = new FormData();
            form.append("archivo", archivo);
            const res = await fetch("/api/profesional/autorizacion", {
                method: "POST",
                credentials: "include",
                body: form,
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorArchivo(json?.error?.message ?? "No pudimos subir la autorización.");
                return;
            }
            setPerfil(json.perfil as Perfil);
            setOk("Autorización recibida.");
        } finally {
            setSubiendo(false);
        }
    };

    if (cargando) {
        return (
            <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
                <p className="text-muted">Cargando…</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            <h1 className="font-serif text-3xl text-body">Completá tu perfil</h1>
            <p className="mt-2 text-sm text-muted">
                Cuando termines el perfil y subas tu autorización firmada, tu ficha entra a la revisión de
                Innovadataco. Mientras tanto queda como borrador y nadie la ve.
            </p>
            {perfil && (
                <p className="mt-3 text-sm">
                    Estado: <strong className="text-body">{perfil.estado}</strong>
                    {perfil.estado === "EN_REVISION" && (
                        <span className="text-accent"> · te avisamos cuando IDC responda.</span>
                    )}
                </p>
            )}

            {ok && (
                <Alerta tono="exito" className="mt-4">
                    {ok}
                </Alerta>
            )}

            <GlassCard className="mt-6">
                <form onSubmit={guardar} className="space-y-4">
                    <Input label="Cómo querés que te vean" value={nombreVisible} onChange={(e) => setNombreVisible(e.target.value)} />
                    <Input label="Título profesional" value={tituloProfesional} onChange={(e) => setTituloProfesional(e.target.value)} />
                    <Input
                        label="Especialidades (separadas por coma)"
                        value={especialidadesTexto}
                        onChange={(e) => setEspecialidadesTexto(e.target.value)}
                    />
                    <Input label="ID de tu ciudad" value={ciudadId} onChange={(e) => setCiudadId(e.target.value)} />
                    <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={atiendeVirtual} onChange={(e) => setAtiendeVirtual(e.target.checked)} />
                            Atiendo virtual
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={atiendePresencial} onChange={(e) => setAtiendePresencial(e.target.checked)} />
                            Atiendo presencial
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={emiteFactura} onChange={(e) => setEmiteFactura(e.target.checked)} />
                            Emito factura
                        </label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Input
                            label="Años de experiencia"
                            type="number"
                            min={0}
                            value={aniosExperiencia}
                            onChange={(e) => setAniosExperiencia(Number(e.target.value))}
                        />
                        <Input
                            label="Tarifa por consulta (COP)"
                            type="number"
                            min={0}
                            value={tarifaConsultaCOP}
                            onChange={(e) => setTarifaConsultaCOP(Number(e.target.value))}
                        />
                        <Input
                            label="Duración (min)"
                            type="number"
                            min={15}
                            max={240}
                            value={duracionMinutos}
                            onChange={(e) => setDuracionMinutos(Number(e.target.value))}
                        />
                    </div>
                    <label className="block text-sm text-body">
                        Presentación
                        <textarea
                            value={presentacion}
                            onChange={(e) => setPresentacion(e.target.value)}
                            className="mt-1 w-full min-h-32 rounded-lg border border-tinta/15 bg-transparent px-3 py-2 text-sm"
                            maxLength={1500}
                            placeholder="Contá quién sos y con quién trabajás mejor, en pocas líneas."
                        />
                    </label>
                    <Input
                        label="Número de tarjeta profesional (interno)"
                        value={numeroTarjetaProfesional}
                        onChange={(e) => setNumeroTarjeta(e.target.value)}
                    />
                    {errorPerfil && (
                        <Alerta tono="advertencia" className="text-center">
                            {errorPerfil}
                        </Alerta>
                    )}
                    <Button type="submit" isLoading={guardando} className="w-full">
                        Guardar perfil
                    </Button>
                </form>
            </GlassCard>

            <GlassCard className="mt-6">
                <h2 className="text-lg font-semibold text-body">Autorización firmada</h2>
                <p className="mt-1 text-sm text-muted">
                    Subí el documento firmado que autoriza la consulta de antecedentes. Aceptamos PDF, PNG y JPG,
                    hasta 5 MB. La ley exige que quede archivada — la guardamos cifrada y solo Innovadataco la lee.
                </p>
                <div className="mt-4 space-y-3">
                    <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                        className="text-sm"
                    />
                    {perfil?.autorizacionSubida && (
                        <p className="text-sm text-accent">Ya subiste una autorización.</p>
                    )}
                    {errorArchivo && (
                        <Alerta tono="advertencia" className="text-center">
                            {errorArchivo}
                        </Alerta>
                    )}
                    <Button onClick={subirAutorizacion} isLoading={subiendo} disabled={!archivo} variant="secondary">
                        {perfil?.autorizacionSubida ? "Reemplazar autorización" : "Subir autorización"}
                    </Button>
                </div>

                {/* SPEC-436 (I-304): los requisitos que el Verificador va a revisar.
                    La lista sale del parámetro, no de una constante. */}
                <div className="mt-8 border-t border-tinta/10 pt-6">
                    <h2 className="text-lg font-semibold text-body">Documentos para tu verificación</h2>
                    <p className="mt-1 text-sm text-muted">
                        Estos son los documentos que revisa Innovadataco antes de activarte. Se guardan
                        cifrados, igual que la autorización, y solo los abre quien revisa tu solicitud.
                    </p>
                    <div className="mt-4">
                        <DocumentosRequisitos />
                    </div>
                </div>
            </GlassCard>
        </main>
    );
}

"use client";

/**
 * SPEC-391 (A-75 · L1b) · SPEC-434 (I-302 · Jelkin vivo 04-09) — el profesional
 * completa su ficha.
 *
 * Cambios de SPEC-434:
 *  · País + ciudad con `<Select>` y `CiudadSearchSelect` (mismo componente
 *    que ya usa el reporte y el perfil del padre). El texto libre «ID de tu
 *    ciudad» era un cuid oculto — nadie podía usarlo.
 *  · Voz neutra Colombia (sin voseo) — alinea con módulo de colegio (I-250).
 *  · «Emito factura» fuera de la pantalla (el dato queda en el modelo).
 *  · Años de experiencia como selector 1..50 (antes texto libre).
 *  · Al pasar a `EN_REVISION`, modal con el mensaje humano (no «EN_REVISION»
 *    a la vista del usuario, jamás — ni siquiera como fallback).
 *
 * Estado inicial: `BORRADOR`. Cuando la ficha queda completa Y hay autorización,
 * el backend transiciona a `EN_REVISION` — de ahí lo toma L2 (IDC).
 */
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";

type Perfil = {
    id: string;
    nombreVisible: string;
    tituloProfesional: string;
    especialidades: string[];
    ciudad: { id: string; nombre: string; paisId: string };
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

type PaisOption = { id: string; nombre: string };

const ANIOS_EXPERIENCIA_OPCIONES = (() => {
    const opts: Array<{ value: string; label: string }> = [
        { value: "", label: "Elija los años" },
    ];
    for (let i = 1; i <= 50; i++) {
        opts.push({ value: String(i), label: i === 1 ? "1 año" : `${i} años`});
    }
    return opts;
})();

export default function CompletarPerfilProfesionalPage() {
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [cargando, setCargando] = useState(true);
    const [paises, setPaises] = useState<PaisOption[]>([]);
    const [nombreVisible, setNombreVisible] = useState("");
    const [tituloProfesional, setTituloProfesional] = useState("");
    const [especialidadesTexto, setEspecialidadesTexto] = useState("");
    const [paisId, setPaisId] = useState("");
    const [ciudad, setCiudad] = useState<CiudadOpcion | null>(null);
    const [atiendeVirtual, setAtiendeVirtual] = useState(false);
    const [atiendePresencial, setAtiendePresencial] = useState(false);
    const [aniosExperiencia, setAniosExperiencia] = useState<string>("");
    const [presentacion, setPresentacion] = useState("");
    const [tarifaConsultaCOP, setTarifaConsultaCOP] = useState<number>(0);
    const [duracionMinutos, setDuracionMinutos] = useState<number>(45);
    const [numeroTarjetaProfesional, setNumeroTarjeta] = useState("");
    const [archivo, setArchivo] = useState<File | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [errorPerfil, setErrorPerfil] = useState("");
    const [errorArchivo, setErrorArchivo] = useState("");
    const [ok, setOk] = useState("");
    // SPEC-434 punto 5: modal al pasar a EN_REVISION. Se abre una sola vez
    // por transición y NUNCA muestra el nombre técnico del estado.
    const [modalRevision, setModalRevision] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [perfilRes, paisRes] = await Promise.all([
                    fetch("/api/profesional/perfil", { credentials: "include" }),
                    fetch("/api/paises", { credentials: "include" }),
                ]);
                const paisJson = await paisRes.json().catch(() => ({}));
                setPaises((paisJson.paises ?? []) as PaisOption[]);
                if (perfilRes.ok) {
                    const json = await perfilRes.json();
                    if (json.perfil) {
                        const p: Perfil = json.perfil;
                        setPerfil(p);
                        setNombreVisible(p.nombreVisible);
                        setTituloProfesional(p.tituloProfesional);
                        setEspecialidadesTexto(p.especialidades.join(", "));
                        if (p.ciudad?.id && p.ciudad.paisId) {
                            setPaisId(p.ciudad.paisId);
                            setCiudad({
                                id: p.ciudad.id,
                                nombre: p.ciudad.nombre,
                                paisId: p.ciudad.paisId,
                                departamentoId: null,
                                departamento: null,
                            });
                        }
                        setAtiendeVirtual(p.atiendeVirtual);
                        setAtiendePresencial(p.atiendePresencial);
                        setAniosExperiencia(p.aniosExperiencia > 0 ? String(p.aniosExperiencia) : "");
                        setPresentacion(p.presentacion);
                        setTarifaConsultaCOP(p.tarifaConsultaCOP);
                        setDuracionMinutos(p.duracionMinutos);
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
        if (!ciudad?.id) {
            setErrorPerfil("Seleccione su ciudad usando el buscador.");
            return;
        }
        const anios = Number(aniosExperiencia);
        if (!Number.isInteger(anios) || anios < 1 || anios > 50) {
            setErrorPerfil("Seleccione sus años de experiencia (entre 1 y 50).");
            return;
        }
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
                    ciudadId: ciudad.id,
                    atiendeVirtual,
                    atiendePresencial,
                    aniosExperiencia: anios,
                    presentacion,
                    tarifaConsultaCOP,
                    duracionMinutos,
                    numeroTarjetaProfesional: numeroTarjetaProfesional || null,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorPerfil(json?.error?.message ?? "No fue posible guardar la ficha.");
                return;
            }
            const nuevo = json.perfil as Perfil;
            const antes = perfil?.estado ?? "BORRADOR";
            setPerfil(nuevo);
            if (antes !== "EN_REVISION" && nuevo.estado === "EN_REVISION") {
                setModalRevision(true);
            } else {
                setOk("Cambios guardados.");
            }
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
                setErrorArchivo(json?.error?.message ?? "No fue posible subir la autorización.");
                return;
            }
            const nuevo = json.perfil as Perfil;
            const antes = perfil?.estado ?? "BORRADOR";
            setPerfil(nuevo);
            if (antes !== "EN_REVISION" && nuevo.estado === "EN_REVISION") {
                setModalRevision(true);
            } else {
                setOk("Autorización recibida.");
            }
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

    // SPEC-434 punto 2: voz neutra Colombia — sin voseo.
    // SPEC-434 punto 5: en pantalla NUNCA aparece «EN_REVISION». Si el perfil
    // ya está en ese estado (usuario recarga después de entregar), se pinta
    // un mensaje humano.
    const yaEnRevision = perfil?.estado === "EN_REVISION";

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            <h1 className="font-serif text-3xl text-body">Complete su perfil</h1>
            <p className="mt-2 text-sm text-muted">
                Cuando termine la ficha y suba su autorización firmada, el equipo de
                Innovadataco la revisa. Mientras tanto queda como borrador y nadie la ve.
            </p>
            {yaEnRevision && (
                <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-sm text-body">
                    Su ficha está en revisión. Le enviaremos un correo cuando pueda continuar.
                </p>
            )}

            {ok && (
                <Alerta tono="exito" className="mt-4">
                    {ok}
                </Alerta>
            )}

            <GlassCard className="mt-6">
                <form onSubmit={guardar} className="space-y-4">
                    <Input label="Cómo desea que lo vean" value={nombreVisible} onChange={(e) => setNombreVisible(e.target.value)} />
                    <Input label="Título profesional" value={tituloProfesional} onChange={(e) => setTituloProfesional(e.target.value)} />
                    <Input
                        label="Especialidades (separadas por coma)"
                        value={especialidadesTexto}
                        onChange={(e) => setEspecialidadesTexto(e.target.value)}
                    />

                    {/* SPEC-434 punto 1 · país + ciudad como en el reporte. */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            label="País"
                            value={paisId}
                            onChange={(e) => {
                                setPaisId(e.target.value);
                                setCiudad(null);
                            }}
                            options={[{ value: "", label: "Elija país" }, ...paises.map((p) => ({ value: p.id, label: p.nombre }))]}
                        />
                        <CiudadSearchSelect
                            paisId={paisId}
                            value={ciudad}
                            onSelect={setCiudad}
                            disabled={!paisId}
                            permitirOtra={false}
                        />
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={atiendeVirtual} onChange={(e) => setAtiendeVirtual(e.target.checked)} />
                            Atiendo virtual
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={atiendePresencial} onChange={(e) => setAtiendePresencial(e.target.checked)} />
                            Atiendo presencial
                        </label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {/* SPEC-434 punto 4 · años como selector 1..50. */}
                        <Select
                            label="Años de experiencia"
                            value={aniosExperiencia}
                            onChange={(e) => setAniosExperiencia(e.target.value)}
                            options={ANIOS_EXPERIENCIA_OPCIONES}
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
                            placeholder="Escriba quién es y con quién trabaja mejor, en pocas líneas."
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
                    Suba el documento firmado que autoriza la consulta de antecedentes.
                    Aceptamos PDF, PNG y JPG, hasta 5 MB. La ley exige que quede archivada —
                    la guardamos cifrada y solo Innovadataco la lee.
                </p>
                <div className="mt-4 space-y-3">
                    <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                        className="text-sm"
                    />
                    {perfil?.autorizacionSubida && (
                        <p className="text-sm text-accent">Ya subió una autorización.</p>
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
                    <h2 className="text-lg font-semibold text-body">Documentos para su verificación</h2>
                    <p className="mt-1 text-sm text-muted">
                        Estos son los documentos que revisa Innovadataco antes de activarte. Se guardan
                        cifrados, igual que la autorización, y solo los abre quien revisa su solicitud.
                    </p>
                    <div className="mt-4">
                        <DocumentosRequisitos />
                    </div>
                </div>
            </GlassCard>

            {modalRevision && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="revision-titulo"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-4"
                >
                    <div className="w-full max-w-md rounded-2xl bg-page p-6 shadow-xl">
                        <h2 id="revision-titulo" className="font-serif text-xl text-body">
                            Su ficha quedó entregada
                        </h2>
                        <p className="mt-3 text-sm text-body">
                            El equipo de Innovadataco va a revisar su caso. Cuando termine, le llegará
                            un correo con el resultado y los pasos a seguir.
                        </p>
                        <p className="mt-2 text-sm text-muted">
                            Mientras tanto, esta pantalla queda a su disposición para editar la ficha.
                        </p>
                        <div className="mt-5 flex justify-end">
                            <Button onClick={() => setModalRevision(false)}>Entendido</Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

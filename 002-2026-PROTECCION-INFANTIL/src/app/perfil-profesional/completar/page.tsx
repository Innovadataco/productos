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
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { DocumentosRequisitos } from "@/components/modules/profesional/DocumentosRequisitos";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { MENSAJE_MODALIDAD_REQUERIDA, MENSAJE_MODALIDAD_FALTA_CAMPO } from "@/lib/profesional/modalidad-estado";
import type { OpcionCatalogo, GrupoAreas } from "@/lib/profesional/catalogos";

type Catalogos = { profesion: OpcionCatalogo[]; areas: GrupoAreas[]; rangoEtario: OpcionCatalogo[] };

type Perfil = {
    id: string;
    nombreVisible: string;
    // SPEC-685 (PR2): listas cerradas en vez de título/especialidades libres.
    profesion: string | null;
    areasAtencion: string[];
    rangoEtario: string[];
    ciudad: { id: string; nombre: string; paisId: string };
    atiendeVirtual: boolean;
    atiendePresencial: boolean;
    aniosExperiencia: number;
    presentacion: string;
    emiteFactura: boolean;
    estado: string;
};

// SPEC-703: estado de la autorización ACEPTADA EN PANTALLA (reemplaza la subida de PDF).
type Autorizacion = {
    version: string | null;
    aceptadaVigente: boolean;
    aceptadaEn: string | null;
    versionAceptada: string | null;
};

type PaisOption = { id: string; nombre: string };

// SPEC-685 (PR2): alterna una clave en una lista múltiple (áreas / rango).
const toggleEnLista = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    clave: string,
) => setter((prev) => (prev.includes(clave) ? prev.filter((x) => x !== clave) : [...prev, clave]));

// SPEC-685 (PR2): catálogos ya resueltos (vacíos mientras cargan) para el render.
const catalogosOVacio = (c: Catalogos | null) => ({
    profesion: c?.profesion ?? [],
    areas: c?.areas ?? [],
    rangoEtario: c?.rangoEtario ?? [],
});

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
    const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
    const [nombreVisible, setNombreVisible] = useState("");
    // SPEC-685 (PR2): profesión (única) + áreas y rango etario (múltiples), por CLAVE.
    const [profesion, setProfesion] = useState("");
    const [areasAtencion, setAreasAtencion] = useState<string[]>([]);
    const [rangoEtario, setRangoEtario] = useState<string[]>([]);
    const [paisId, setPaisId] = useState("");
    const [ciudad, setCiudad] = useState<CiudadOpcion | null>(null);
    const [atiendeVirtual, setAtiendeVirtual] = useState(false);
    const [atiendePresencial, setAtiendePresencial] = useState(false);
    const [aniosExperiencia, setAniosExperiencia] = useState<string>("");
    const [presentacion, setPresentacion] = useState("");
    const [numeroTarjetaProfesional, setNumeroTarjeta] = useState("");
    // SPEC-703: la autorización se ACEPTA EN PANTALLA (no se sube PDF); acá solo se muestra su estado.
    const [autorizacion, setAutorizacion] = useState<Autorizacion | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [errorPerfil, setErrorPerfil] = useState("");
    const [ok, setOk] = useState("");
    // SPEC-434 punto 5: modal al pasar a EN_REVISION. Se abre una sola vez
    // por transición y NUNCA muestra el nombre técnico del estado.
    const [modalRevision, setModalRevision] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [perfilRes, paisRes, catRes] = await Promise.all([
                    fetch("/api/profesional/perfil", { credentials: "include" }),
                    fetch("/api/paises", { credentials: "include" }),
                    fetch("/api/profesional/catalogos", { credentials: "include" }),
                ]);
                const paisJson = await paisRes.json().catch(() => ({}));
                setPaises((paisJson.paises ?? []) as PaisOption[]);
                const catJson = await catRes.json().catch(() => ({}));
                if (catJson.catalogos) setCatalogos(catJson.catalogos as Catalogos);
                if (perfilRes.ok) {
                    const json = await perfilRes.json();
                    setAutorizacion((json.autorizacion ?? null) as Autorizacion | null);
                    if (json.perfil) {
                        const p: Perfil = json.perfil;
                        setPerfil(p);
                        setNombreVisible(p.nombreVisible);
                        setProfesion(p.profesion ?? "");
                        setAreasAtencion(p.areasAtencion ?? []);
                        setRangoEtario(p.rangoEtario ?? []);
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
            const res = await fetch("/api/profesional/perfil", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombreVisible,
                    profesion,
                    areasAtencion,
                    rangoEtario,
                    ciudadId: ciudad.id,
                    atiendeVirtual,
                    atiendePresencial,
                    aniosExperiencia: anios,
                    presentacion,
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

    // SPEC-673 (I-398 · Diseño opción ii): la aptitud de ENVÍO se evalúa en el
    // cliente (distinta del guard de servidor, que exime BORRADOR a propósito).
    // Hace la incompletitud legible SIEMPRE — no recién al intentar enviar — así
    // el profesional no queda «terminado y trabado» sin saber qué falta.
    const faltaModalidad = !atiendeVirtual && !atiendePresencial;

    // SPEC-685 (PR2): catálogos ya con fallback resuelto (vacío mientras cargan).
    const { profesion: opcionesProfesion, areas: gruposAreas, rangoEtario: opcionesRango } =
        catalogosOVacio(catalogos);

    return (
        <main className="mx-auto max-w-3xl px-4 py-8">
            <h1 className="font-serif text-3xl text-body">Complete su perfil</h1>
            <p className="mt-2 text-sm text-muted">
                {/* SPEC-704 (ajuste del CEO): la autorización se ACEPTA en pantalla, no se sube
                    firmada — el encabezado tiene que decir lo que el usuario realmente hace. */}
                Cuando termine la ficha y acepte la autorización, el equipo de
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
                    {/* SPEC-685 (PR2 · FORMA de Diseño): «Nombre público» NOMBRA la cosa
                        (sustantivo) + un ejemplo que ES un nombre → empuja a un nombre, no a
                        una descripción. La ayuda dice «en el directorio» y nada más: tras una
                        cita confirmada el contacto SÍ se comparte (H-2). maxLength 50 ahoga un
                        párrafo. La descripción tiene casa: Presentación. */}
                    <div>
                        <Input
                            label="Nombre público"
                            value={nombreVisible}
                            onChange={(e) => setNombreVisible(e.target.value)}
                            placeholder="Dra. Ramírez"
                            maxLength={50}
                        />
                        <p className="mt-1 text-sm text-subtle">
                            Así lo verán las familias en el directorio. Escríbalo como un nombre, no como una descripción.
                        </p>
                        <p className="mt-1 text-xs text-subtle">
                            ¿Quiere contar su experiencia? Eso va en Presentación.
                        </p>
                    </div>

                    {/* SPEC-685 (PR2): profesión = lista cerrada (única). */}
                    <Select
                        label="Profesión"
                        value={profesion}
                        onChange={(e) => setProfesion(e.target.value)}
                        options={[
                            { value: "", label: "Elija su profesión" },
                            ...opcionesProfesion.map((o) => ({ value: o.clave, label: o.nombre })),
                        ]}
                    />

                    {/* SPEC-685 (PR2): áreas de atención = lista cerrada agrupada (múltiple). */}
                    <fieldset className="space-y-3">
                        <legend className="block text-sm font-medium text-body">Áreas de atención</legend>
                        <p className="text-sm text-subtle">Marque en lo que trabaja. Puede elegir varias.</p>
                        {gruposAreas.map((g) => (
                            <div key={g.grupo} className="space-y-1.5">
                                <p className="text-xs uppercase tracking-wide text-subtle">{g.grupo}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {g.items.map((o) => (
                                        <label key={o.clave} className="flex items-center gap-2 text-sm text-body">
                                            <input
                                                type="checkbox"
                                                checked={areasAtencion.includes(o.clave)}
                                                onChange={() => toggleEnLista(setAreasAtencion, o.clave)}
                                            />
                                            {o.nombre}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </fieldset>

                    {/* SPEC-685 (PR2): rango etario = lista cerrada (múltiple). Reemplaza «Niños». */}
                    <fieldset className="space-y-1.5">
                        <legend className="block text-sm font-medium text-body">Edad que atiende</legend>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {opcionesRango.map((o) => (
                                <label key={o.clave} className="flex items-center gap-2 text-sm text-body">
                                    <input
                                        type="checkbox"
                                        checked={rangoEtario.includes(o.clave)}
                                        onChange={() => toggleEnLista(setRangoEtario, o.clave)}
                                    />
                                    {o.nombre}
                                </label>
                            ))}
                        </div>
                    </fieldset>

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
                    {/* SPEC-673 (I-398): la incompletitud, legible SIEMPRE (no al intentar). */}
                    {faltaModalidad && (
                        <p role="status" className="text-sm text-estado-ambar">
                            {MENSAJE_MODALIDAD_FALTA_CAMPO}
                        </p>
                    )}
                    {/* SPEC-685 (PR2-bis): la TARIFA y la duración salieron de la ficha
                        y viven en «Mi perfil» (solo el habilitado). Antes de estar
                        habilitado no hay tarifa que fijar ni cobrar. */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* SPEC-434 punto 4 · años como selector 1..50. */}
                        <Select
                            label="Años de experiencia"
                            value={aniosExperiencia}
                            onChange={(e) => setAniosExperiencia(e.target.value)}
                            options={ANIOS_EXPERIENCIA_OPCIONES}
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
                    {/* SPEC-673 (I-398 · pieza 3): junto al botón, la razón por la que
                        guardar no pasa a revisión. Guardar sigue permitido (opción ii);
                        no es un botón gris sin explicación. */}
                    {faltaModalidad && (
                        <p className="text-sm text-estado-ambar">{MENSAJE_MODALIDAD_REQUERIDA}</p>
                    )}
                    <Button type="submit" isLoading={guardando} className="w-full">
                        Guardar perfil
                    </Button>
                </form>
            </GlassCard>

            <GlassCard className="mt-6">
                {/* SPEC-703: la autorización se ACEPTA EN PANTALLA (Ley 1918/2018), no se sube PDF.
                    Aquí va su ESTADO + el enlace a leerla/aceptarla; al aceptar, el profesional
                    vuelve a esta ficha. La completitud para pasar a revisión exige esta aceptación. */}
                <h2 className="text-lg font-semibold text-body">Autorización</h2>
                <p className="mt-1 text-sm text-muted">
                    Para revisar su perfil necesitamos que autorice la verificación de sus
                    antecedentes y el tratamiento de sus datos. La lee y la acepta en pantalla;
                    queda registrada con su fecha y versión.
                </p>
                <div className="mt-4 space-y-3">
                    {autorizacion?.aceptadaVigente ? (
                        <p className="text-sm text-body">
                            <span className="font-medium">Autorización aceptada.</span>
                            {autorizacion.aceptadaEn
                                ? ` Aceptada el ${new Date(autorizacion.aceptadaEn).toLocaleDateString("es-CO", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}`
                                : ""}
                            {autorizacion.version ? ` · versión ${autorizacion.version}` : ""}
                        </p>
                    ) : (
                        <p className="text-sm text-estado-ambar">
                            <span className="font-medium">Falta aceptar la autorización.</span> Sin ella no
                            podemos pasar su perfil a revisión.
                        </p>
                    )}
                    <Link
                        href="/perfil-profesional/autorizacion"
                        className="inline-block text-sm font-medium text-accent underline underline-offset-2"
                    >
                        {autorizacion?.aceptadaVigente ? "Ver la autorización" : "Leer y aceptar la autorización"}
                    </Link>
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

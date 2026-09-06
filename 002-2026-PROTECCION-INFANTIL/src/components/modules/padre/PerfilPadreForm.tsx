"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { CiudadSearchSelect, type CiudadOpcion } from "@/components/ui/CiudadSearchSelect";
import { Cargando } from "@/components/ui/Cargando";
import { EDAD_MIN_PADRE, EDAD_MAX_PADRE } from "@/lib/padre/fecha-nacimiento-padre";

// SPEC-541: min/max del input de fecha de nacimiento (18–100 años), en UTC para
// casar con la validación del servidor. El servidor sigue siendo la defensa real;
// esto solo tapa el caso amable (Calidad · el input no tenía min/max).
function fechaHaceAnios(anios: number): string {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getUTCFullYear() - anios, hoy.getUTCMonth(), hoy.getUTCDate()))
        .toISOString()
        .slice(0, 10);
}

type PaisOption = { id: string; nombre: string };

type Perfil = {
    nombre: string | null;
    apellidos: string | null;
    documentoTipo: string | null;
    documentoNumero: string | null;
    fechaNacimiento: string | null;
    telefono: string | null;
    paisId: string | null;
    ciudadId: string | null;
    paisPerfil: { id: string; nombre: string } | null;
    ciudadPerfil: { id: string; nombre: string } | null;
};

// SPEC-334: perfil del padre — ver y editar los 6 datos. País/ciudad del catálogo
// existente (sin "Otra ciudad"); fecha con selector de fecha; teléfono validado.
/**
 * SPEC-339 (A-67): el formulario sirve a dos pantallas.
 *  - "perfil" (default): la página de perfil de SPEC-334, con fecha de nacimiento.
 *  - "camino": el Paso 2 del camino guiado — exige los 7 campos del brief §2.3
 *    (documento incluido), NO pide fecha de nacimiento (decisión CEO D-2) y al
 *    guardar avanza en vez de quedarse.
 */
export function PerfilPadreForm({
    variante = "perfil",
    onGuardado,
}: {
    variante?: "perfil" | "camino";
    onGuardado?: () => void;
} = {}) {
    const esCamino = variante === "camino";
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState(false);
    const [paises, setPaises] = useState<PaisOption[]>([]);

    const [nombre, setNombre] = useState("");
    const [apellidos, setApellidos] = useState("");
    // SPEC-339 (§2.3): documento del padre — da validez al expediente.
    const [documentoTipo, setDocumentoTipo] = useState("");
    const [documentoNumero, setDocumentoNumero] = useState("");
    const [fechaNacimiento, setFechaNacimiento] = useState("");
    const [telefono, setTelefono] = useState("");
    const [paisId, setPaisId] = useState("");
    const [ciudad, setCiudad] = useState<CiudadOpcion | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const [pRes, paisRes] = await Promise.all([
                    fetch("/api/padre/perfil", { credentials: "include" }),
                    fetch("/api/paises", { credentials: "include" }),
                ]);
                const paisJson = await paisRes.json();
                setPaises(paisJson.paises || []);
                if (pRes.ok) {
                    const { perfil } = (await pRes.json()) as { perfil: Perfil };
                    setNombre(perfil.nombre ?? "");
                    setApellidos(perfil.apellidos ?? "");
                    setDocumentoTipo(perfil.documentoTipo ?? "");
                    setDocumentoNumero(perfil.documentoNumero ?? "");
                    setFechaNacimiento(perfil.fechaNacimiento ? perfil.fechaNacimiento.slice(0, 10) : "");
                    setTelefono(perfil.telefono ?? "");
                    setPaisId(perfil.paisId ?? "");
                    if (perfil.ciudadId && perfil.ciudadPerfil) {
                        setCiudad({ id: perfil.ciudadId, nombre: perfil.ciudadPerfil.nombre, paisId: perfil.paisId ?? "", departamentoId: null, departamento: null });
                    }
                }
            } catch {
                setError("No pudimos cargar tu perfil.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    async function guardar(e: React.FormEvent) {
        e.preventDefault();
        // SPEC-342 (I-234): en el camino, los 7 campos del Paso 2 son obligatorios
        // y el faltante se dice ANTES de enviar. Sin esto el padre guardaba sin
        // ciudad, el guardián seguía exigiéndola y el rebote quedaba mudo.
        if (esCamino) {
            const faltantes: string[] = [];
            if (!nombre.trim()) faltantes.push("tus nombres");
            if (!apellidos.trim()) faltantes.push("tus apellidos");
            if (!documentoTipo) faltantes.push("el tipo de documento");
            if (!documentoNumero.trim()) faltantes.push("el número de documento");
            if (!telefono.trim()) faltantes.push("tu teléfono");
            if (!paisId) faltantes.push("tu país");
            if (!ciudad?.id) faltantes.push("tu ciudad");
            if (faltantes.length > 0) {
                setError(`Te falta ${faltantes.join(", ")} para continuar.`);
                return;
            }
        }
        setSaving(true);
        setError(null);
        setOk(false);
        try {
            const res = await fetch("/api/padre/perfil", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    nombre: nombre.trim() || undefined,
                    apellidos: apellidos.trim() || undefined,
                    documentoTipo: documentoTipo || undefined,
                    documentoNumero: documentoNumero.trim() || undefined,
                    // D-2: el camino no pide la fecha; el perfil normal la conserva.
                    ...(esCamino ? {} : { fechaNacimiento: fechaNacimiento || null }),
                    telefono: telefono.trim() || null,
                    paisId: paisId || null,
                    ciudadId: ciudad?.id || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "No pudimos guardar tu perfil.");
                return;
            }
            setOk(true);
            onGuardado?.();
        } catch {
            setError("Error de red al guardar.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="glass rounded-2xl p-8 text-center"><Cargando texto="Cargando tu perfil…" /></div>;

    return (
        <form onSubmit={guardar} className="glass space-y-4 rounded-2xl p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Nombres" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tus nombres" />
                <Input label="Apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Tus apellidos" />
                <Select
                    label="Tipo de documento"
                    options={[
                        { value: "", label: "Elige" },
                        { value: "CC", label: "Cédula de ciudadanía" },
                        { value: "CE", label: "Cédula de extranjería" },
                        { value: "PASAPORTE", label: "Pasaporte" },
                        { value: "NIT", label: "NIT" },
                        { value: "OTRO", label: "Otro" },
                    ]}
                    value={documentoTipo}
                    onChange={(e) => setDocumentoTipo(e.target.value)}
                />
                <Input label="Número de documento" value={documentoNumero} onChange={(e) => setDocumentoNumero(e.target.value)} placeholder="Sin puntos ni espacios" />
                {!esCamino && (
                    <Input
                        label="Fecha de nacimiento"
                        type="date"
                        value={fechaNacimiento}
                        min={fechaHaceAnios(EDAD_MAX_PADRE)}
                        max={fechaHaceAnios(EDAD_MIN_PADRE)}
                        onChange={(e) => setFechaNacimiento(e.target.value)}
                    />
                )}
                <Input label="Teléfono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej. +57 300 123 4567" />
                <Select
                    label="País"
                    options={[{ value: "", label: "Selecciona un país" }, ...paises.map((p) => ({ value: p.id, label: p.nombre }))]}
                    value={paisId}
                    onChange={(e) => {
                        setPaisId(e.target.value);
                        setCiudad(null); // país→ciudad dependiente: al cambiar país, se limpia la ciudad
                    }}
                />
                <CiudadSearchSelect paisId={paisId} value={ciudad} onSelect={setCiudad} disabled={!paisId} permitirOtra={false} />
            </div>

            {error && <p className="text-sm text-estado-rubi">{error}</p>}
            {ok && <p className="text-sm text-estado-pino">Tus datos quedaron guardados.</p>}

            <div className={esCamino ? "" : "flex justify-end"}>
                <Button type="submit" isLoading={saving} className={esCamino ? "w-full" : ""}>
                    {saving ? "Guardando…" : esCamino ? "Siguiente: tus hijos" : "Guardar mis datos"}
                </Button>
            </div>
        </form>
    );
}

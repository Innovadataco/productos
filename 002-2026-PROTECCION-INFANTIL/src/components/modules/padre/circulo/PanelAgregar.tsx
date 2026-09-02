"use client";

/**
 * A-73 (SPEC-367) · Agregar a alguien: tres preguntas en el orden en que un
 * padre las piensa (cómo se llama · qué es de tus hijos · cómo se le encuentra).
 * Sin jerga: nunca "identificador", "etiqueta" ni "tipo".
 *
 * El mismo panel sirve para sumar otro dato a alguien que ya está (modo "dato"):
 * ahí solo se muestra la tercera pregunta.
 */
import { useState } from "react";
import { nombreVisible, type Contacto, type Plataforma } from "./tipos";

/** Lista cerrada + "Otro" (que abre texto libre): el campo de BD sigue libre. */
const PARENTESCOS = [
    "Tío / tía",
    "Abuelo / abuela",
    "Primo / prima",
    "Niñero / niñera",
    "Entrenador",
    "Profesor",
    "Vecino",
    "Amigo de la familia",
] as const;

export type DatoNuevo = { valor: string; plataformaId: string };

type Props = {
    modo: "persona" | "dato";
    plataformas: Plataforma[];
    /** En modo "dato": a quién se le suma. */
    contacto?: Contacto;
    guardando: boolean;
    error?: string;
    onCancelar: () => void;
    onGuardarPersona: (datos: { nombre: string; parentesco: string; datos: DatoNuevo[] }) => void;
    onGuardarDato: (contacto: Contacto, datos: DatoNuevo[]) => void;
};

export function PanelAgregar({
    modo,
    plataformas,
    contacto,
    guardando,
    error,
    onCancelar,
    onGuardarPersona,
    onGuardarDato,
}: Props) {
    const [nombre, setNombre] = useState("");
    const [parentesco, setParentesco] = useState("");
    const [otroParentesco, setOtroParentesco] = useState("");
    const [eligióOtro, setEligióOtro] = useState(false);
    const [datos, setDatos] = useState<DatoNuevo[]>([{ valor: "", plataformaId: "" }]);

    const esPersona = modo === "persona";
    const parentescoFinal = eligióOtro ? otroParentesco.trim() : parentesco;
    const datosLlenos = datos.filter((d) => d.valor.trim() !== "");
    const puedeGuardar =
        !guardando && datosLlenos.length > 0 && (!esPersona || nombre.trim().length > 0);

    const primerNombre = nombre.trim().split(/\s+/)[0] ?? "";

    function cambiarDato(index: number, campo: keyof DatoNuevo, valor: string) {
        setDatos((prev) => prev.map((d, i) => (i === index ? { ...d, [campo]: valor } : d)));
    }

    function enviar(e: React.FormEvent) {
        e.preventDefault();
        if (!puedeGuardar) return;
        const limpios = datosLlenos.map((d) => ({ valor: d.valor.trim(), plataformaId: d.plataformaId }));
        if (esPersona) {
            onGuardarPersona({ nombre: nombre.trim(), parentesco: parentescoFinal, datos: limpios });
        } else if (contacto) {
            onGuardarDato(contacto, limpios);
        }
    }

    return (
        <form
            onSubmit={enviar}
            aria-labelledby="panel-agregar-titulo"
            className="flex flex-col gap-5 rounded-2xl border border-tinta/10 bg-white p-5 shadow-sm dark:bg-tinta/20"
        >
            <div className="flex items-start justify-between gap-3">
                <h2 id="panel-agregar-titulo" className="text-xl font-semibold text-body">
                    {esPersona ? "Agregar a alguien" : `Otro dato de ${contacto ? nombreVisible(contacto) : ""}`}
                </h2>
                <button
                    type="button"
                    onClick={onCancelar}
                    aria-label="Cerrar"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-papel hover:text-body"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>

            {esPersona && (
                <>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="circulo-nombre" className="text-sm font-semibold text-body">
                            ¿Cómo se llama?
                        </label>
                        <input
                            id="circulo-nombre"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            maxLength={100}
                            autoComplete="off"
                            placeholder="Su nombre"
                            className="h-12 rounded-xl border border-tinta/15 bg-papel px-3.5 text-body outline-none transition focus:border-pino focus:ring-2 focus:ring-pino/25"
                        />
                    </div>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-sm font-semibold text-body">¿Qué es de tus hijos?</legend>
                        <div className="flex flex-wrap gap-2">
                            {PARENTESCOS.map((p) => {
                                const activo = !eligióOtro && parentesco === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        aria-pressed={activo}
                                        onClick={() => {
                                            setEligióOtro(false);
                                            setParentesco(activo ? "" : p);
                                        }}
                                        className={`rounded-full border px-3.5 py-2 text-sm transition ${
                                            activo
                                                ? "border-pino bg-pino font-semibold text-white"
                                                : "border-tinta/15 bg-white text-muted hover:border-pino/40 dark:bg-tinta/10"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                aria-pressed={eligióOtro}
                                onClick={() => {
                                    setEligióOtro(!eligióOtro);
                                    setParentesco("");
                                }}
                                className={`rounded-full border px-3.5 py-2 text-sm transition ${
                                    eligióOtro
                                        ? "border-pino bg-pino font-semibold text-white"
                                        : "border-tinta/15 bg-white text-muted hover:border-pino/40 dark:bg-tinta/10"
                                }`}
                            >
                                Otro
                            </button>
                        </div>
                        {eligióOtro && (
                            <input
                                value={otroParentesco}
                                onChange={(e) => setOtroParentesco(e.target.value)}
                                maxLength={60}
                                aria-label="Escribe qué es de tus hijos"
                                placeholder="Escríbelo tú"
                                className="mt-1 h-11 rounded-xl border border-tinta/15 bg-papel px-3.5 text-body outline-none transition focus:border-pino focus:ring-2 focus:ring-pino/25"
                            />
                        )}
                    </fieldset>
                </>
            )}

            <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-body">¿Cómo se le encuentra en internet?</span>
                <p className="text-sm text-muted">
                    Su celular o su usuario en una red. Con uno basta; puedes sumar más después.
                </p>
                <div className="flex flex-col gap-2">
                    {datos.map((d, i) => (
                        <div key={i} className="flex flex-col gap-2 sm:flex-row">
                            <select
                                value={d.plataformaId}
                                onChange={(e) => cambiarDato(i, "plataformaId", e.target.value)}
                                aria-label="Dónde"
                                className="h-12 rounded-xl border border-tinta/15 bg-papel px-3 text-body outline-none transition focus:border-pino focus:ring-2 focus:ring-pino/25 sm:w-44"
                            >
                                <option value="">¿Dónde?</option>
                                {plataformas.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre}
                                    </option>
                                ))}
                            </select>
                            <input
                                value={d.valor}
                                onChange={(e) => cambiarDato(i, "valor", e.target.value)}
                                aria-label="Su celular o usuario"
                                autoComplete="off"
                                placeholder="Su celular o usuario"
                                className="h-12 flex-1 rounded-xl border border-tinta/15 bg-papel px-3.5 text-body outline-none transition focus:border-pino focus:ring-2 focus:ring-pino/25"
                            />
                            {datos.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setDatos((prev) => prev.filter((_, idx) => idx !== i))}
                                    className="h-12 rounded-xl px-3 text-sm text-muted transition hover:text-body"
                                >
                                    Quitar
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setDatos((prev) => [...prev, { valor: "", plataformaId: "" }])}
                    className="self-start rounded-xl px-1 py-1 text-sm font-semibold text-pino transition hover:underline"
                >
                    + Agregar otro dato
                </button>
            </div>

            {error && (
                <p role="alert" className="rounded-xl bg-ambar/10 px-3 py-2 text-sm text-ambar">
                    {error}
                </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                    type="submit"
                    disabled={!puedeGuardar}
                    className="inline-flex h-13 min-h-[52px] flex-1 items-center justify-center rounded-xl bg-pino px-6 text-base font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                    {guardando
                        ? "Guardando…"
                        : esPersona
                            ? `Empezar a vigilar${primerNombre ? ` a ${primerNombre}` : ""}`
                            : "Guardar el dato"}
                </button>
                <button
                    type="button"
                    onClick={onCancelar}
                    className="inline-flex h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold text-muted transition hover:text-body"
                >
                    Cancelar
                </button>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-pino/8 px-3 py-2.5 text-sm text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-pino" aria-hidden="true">
                    <path d="M12 3l7 3v6c0 4.5-3 8.3-7 9.5C8 20.3 5 16.5 5 12V6z" />
                </svg>
                <span>
                    {esPersona && primerNombre ? `${primerNombre} no recibe` : "La persona no recibe"} ningún aviso. Solo tú
                    ves esta lista.
                </span>
            </p>
        </form>
    );
}

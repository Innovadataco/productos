"use client";

import { useState } from "react";
import { Boton, Guia, Paso, botonesFrom, pasosFrom } from "./types";

interface EditorGuiaModalProps {
    guia: Guia;
    onClose: () => void;
    onSave: (g: Guia) => void;
    categoriasOcupadas: Set<string>;
}

export function EditorGuiaModal({ guia, onClose, onSave }: EditorGuiaModalProps) {
    const [data, setData] = useState<Guia>(guia);
    const [pasos, setPasos] = useState<Paso[]>(() => pasosFrom(guia.pasosJson));
    const [botones, setBotones] = useState<Boton[]>(() => botonesFrom(guia.botonesAccionJson));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...data, pasosJson: pasos, botonesAccionJson: botones });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-papel p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-body">Editar guía</h3>
                    <button type="button" onClick={onClose} className="text-2xl text-muted hover:text-body">×</button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-body">Título emocional</label>
                        <input
                            type="text"
                            value={data.tituloEmocional}
                            onChange={(e) => setData({ ...data, tituloEmocional: e.target.value })}
                            className="mt-1 w-full rounded-md border border-tinta/15 px-3 py-2 text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-body">Subtítulo</label>
                        <input
                            type="text"
                            value={data.subtitulo ?? ""}
                            onChange={(e) => setData({ ...data, subtitulo: e.target.value || null })}
                            className="mt-1 w-full rounded-md border border-tinta/15 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-body">Badge de categoría</label>
                        <input
                            type="text"
                            value={data.categoriaBadgeTexto}
                            onChange={(e) => setData({ ...data, categoriaBadgeTexto: e.target.value })}
                            className="mt-1 w-full rounded-md border border-tinta/15 px-3 py-2 text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-body">Callout título</label>
                        <input
                            type="text"
                            value={data.calloutTitulo ?? ""}
                            onChange={(e) => setData({ ...data, calloutTitulo: e.target.value || null })}
                            className="mt-1 w-full rounded-md border border-tinta/15 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-body">Callout texto</label>
                        <textarea
                            value={data.calloutTexto ?? ""}
                            onChange={(e) => setData({ ...data, calloutTexto: e.target.value || null })}
                            className="mt-1 w-full rounded-md border border-tinta/15 px-3 py-2 text-sm"
                            rows={3}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-body">Pasos</label>
                        {pasos.map((p, idx) => (
                            <div key={idx} className="mt-2 space-y-2 rounded-md border border-tinta/10 p-3">
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={p.orden}
                                        onChange={(e) => {
                                            const next = [...pasos];
                                            next[idx] = { ...p, orden: parseInt(e.target.value, 10) || 0 };
                                            setPasos(next);
                                        }}
                                        className="w-20 rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                    />
                                    <select
                                        value={p.tipo}
                                        onChange={(e) => {
                                            const next = [...pasos];
                                            next[idx] = { ...p, tipo: e.target.value as Paso["tipo"] };
                                            setPasos(next);
                                        }}
                                        className="rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                    >
                                        {["TRANQUILIDAD", "ATENCION", "ACCION", "URGENCIA"].map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={p.titulo}
                                        onChange={(e) => {
                                            const next = [...pasos];
                                            next[idx] = { ...p, titulo: e.target.value };
                                            setPasos(next);
                                        }}
                                        className="flex-1 rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                        placeholder="Título del paso"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPasos(pasos.filter((_, i) => i !== idx))}
                                        className="text-rubi hover:text-rubi/80"
                                    >
                                        ×
                                    </button>
                                </div>
                                <textarea
                                    value={p.descripcion}
                                    onChange={(e) => {
                                        const next = [...pasos];
                                        next[idx] = { ...p, descripcion: e.target.value };
                                        setPasos(next);
                                    }}
                                    className="w-full rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                    placeholder="Descripción"
                                    rows={2}
                                />
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setPasos([...pasos, { orden: pasos.length + 1, tipo: "ACCION", titulo: "", descripcion: "" }])}
                            className="mt-2 text-sm text-cielo hover:text-cielo/80"
                        >
                            + Añadir paso
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-body">Botones de acción</label>
                        {botones.map((b, idx) => (
                            <div key={idx} className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-tinta/10 p-3">
                                <select
                                    value={b.tipo}
                                    onChange={(e) => {
                                        const next = [...botones];
                                        next[idx] = { ...b, tipo: e.target.value as Boton["tipo"] };
                                        setBotones(next);
                                    }}
                                    className="rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                >
                                    <option value="tel">Tel</option>
                                    <option value="url">URL</option>
                                </select>
                                <input
                                    type="text"
                                    value={b.texto}
                                    onChange={(e) => {
                                        const next = [...botones];
                                        next[idx] = { ...b, texto: e.target.value };
                                        setBotones(next);
                                    }}
                                    className="rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                    placeholder="Texto"
                                />
                                <input
                                    type="text"
                                    value={b.subtexto ?? ""}
                                    onChange={(e) => {
                                        const next = [...botones];
                                        next[idx] = { ...b, ...(e.target.value ? { subtexto: e.target.value } : {}) };
                                        setBotones(next);
                                    }}
                                    className="rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                    placeholder="Subtexto"
                                />
                                <input
                                    type="text"
                                    value={b.valor}
                                    onChange={(e) => {
                                        const next = [...botones];
                                        next[idx] = { ...b, valor: e.target.value };
                                        setBotones(next);
                                    }}
                                    className="flex-1 rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                    placeholder={b.tipo === "tel" ? "Número" : "https://..."}
                                />
                                <select
                                    value={b.estilo}
                                    onChange={(e) => {
                                        const next = [...botones];
                                        next[idx] = { ...b, estilo: e.target.value as Boton["estilo"] };
                                        setBotones(next);
                                    }}
                                    className="rounded-md border border-tinta/15 px-2 py-1 text-sm"
                                >
                                    <option value="primario">Primario</option>
                                    <option value="urgente">Urgente</option>
                                    <option value="secundario">Secundario</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setBotones(botones.filter((_, i) => i !== idx))}
                                    className="text-rubi hover:text-rubi/80"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setBotones([...botones, { tipo: "url", texto: "", valor: "", estilo: "secundario" }])}
                            className="mt-2 text-sm text-cielo hover:text-cielo/80"
                        >
                            + Añadir botón
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-body">Pie de página</label>
                        <input
                            type="text"
                            value={data.piePagina ?? ""}
                            onChange={(e) => setData({ ...data, piePagina: e.target.value || null })}
                            className="mt-1 w-full rounded-md border border-tinta/15 px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="rounded-md border border-tinta/15 px-4 py-2 text-sm font-medium text-body hover:bg-tinta/5">
                            Cancelar
                        </button>
                        <button type="submit" className="rounded-md bg-cielo px-4 py-2 text-sm font-medium text-papel hover:bg-cielo/90">
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface PreviewGuiaModalProps {
    guia: Guia;
    onClose: () => void;
}

export function PreviewGuiaModal({ guia, onClose }: PreviewGuiaModalProps) {
    const pasos = pasosFrom(guia.pasosJson);
    const botones = botonesFrom(guia.botonesAccionJson);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-papel p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-full bg-cielo/10 px-3 py-1 text-xs font-semibold text-cielo">{guia.categoriaBadgeTexto}</span>
                    <button type="button" onClick={onClose} className="text-2xl text-muted hover:text-body">×</button>
                </div>
                <h2 className="text-2xl font-bold text-body">{guia.tituloEmocional}</h2>
                {guia.subtitulo && <p className="mt-2 text-muted">{guia.subtitulo}</p>}

                <div className="mt-6 space-y-4">
                    {pasos.map((p) => (
                        <div key={p.orden} className="flex gap-3">
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cielo/10 text-xs font-bold text-cielo">{p.orden}</span>
                            <div>
                                <p className="font-semibold text-body">{p.titulo}</p>
                                <p className="text-sm text-muted">{p.descripcion}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {(guia.calloutTitulo || guia.calloutTexto) && (
                    <div className="mt-6 rounded-md bg-ambar/10 p-4">
                        {guia.calloutTitulo && <p className="font-semibold text-estado-ambar">{guia.calloutTitulo}</p>}
                        {guia.calloutTexto && <p className="mt-1 text-sm text-estado-ambar">{guia.calloutTexto}</p>}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                    {botones.map((b, i) => (
                        <a
                            key={i}
                            href={b.tipo === "tel" ? `tel:${b.valor}` : b.valor}
                            target={b.tipo === "url" ? "_blank" : undefined}
                            rel={b.tipo === "url" ? "noopener noreferrer" : undefined}
                            className={`inline-flex flex-col rounded-md px-4 py-2 text-sm font-medium ${
                                b.estilo === "urgente"
                                    ? "bg-rubi text-papel hover:bg-rubi/90"
                                    : b.estilo === "primario"
                                        ? "bg-cielo text-papel hover:bg-cielo/90"
                                        : "border border-tinta/15 bg-papel text-body hover:bg-tinta/5"
                            }`}
                        >
                            <span>{b.texto}</span>
                            {b.subtexto && <span className="text-xs opacity-80">{b.subtexto}</span>}
                        </a>
                    ))}
                </div>

                {guia.piePagina && <p className="mt-6 text-xs text-muted">{guia.piePagina}</p>}
            </div>
        </div>
    );
}

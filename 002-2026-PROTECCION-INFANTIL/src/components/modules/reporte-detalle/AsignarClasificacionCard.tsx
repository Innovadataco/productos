"use client";

import { Button } from "@/components/ui/Button";
import { CATEGORIAS } from "./types";
import { asignacionListaParaEnviar } from "./capacidades-reporte";

interface AsignarClasificacionCardProps {
    categoria: string;
    setCategoria: (v: string) => void;
    nota: string;
    setNota: (v: string) => void;
    onAsignar: () => void;
    loading: boolean;
}

/**
 * SPEC-574 (I-354) · «Asignar clasificación» — ocupa el slot del par ausente (Corregir/Confirmar) para
 * un reporte que cayó a REVISION_MANUAL sin categoría de la máquina. La condición de aparición vive en
 * `capacidadesAccionesReporte` (el padre solo la renderiza con `puedeClasificar`), así que los tres
 * nunca coexisten.
 *
 * Seguridad (Diseño): clasificar recalcula el score y PUEDE volver público el reporte de un menor. Por
 * eso el botón NO lleva `autoFocus` y arranca DESHABILITADO hasta categoría + nota ≥10 — la nota
 * obligatoria es el candado anti-reflejo (un Enter reflejo no dispara). Sin modal: el doble gate ya son
 * dos actos deliberados. La consecuencia de visibilidad va visible al pie, antes de actuar. Card neutra
 * (no ámbar: el estado «sin determinación» ya va ámbar arriba, SPEC-558). Voz «usted».
 */
export function AsignarClasificacionCard({
    categoria,
    setCategoria,
    nota,
    setNota,
    onAsignar,
    loading,
}: AsignarClasificacionCardProps) {
    return (
        <div className="rounded-lg border border-tinta/10 p-4">
            <h3 className="mb-1 font-medium text-body">Asignar clasificación</h3>
            <p className="mb-3 text-sm text-subtle">
                Este reporte llegó a revisión manual sin categoría de la máquina. Elija la que corresponda.
            </p>
            <label htmlFor="clasificar-categoria" className="mb-1 block text-sm text-subtle">Categoría</label>
            <select
                id="clasificar-categoria"
                data-testid="select-clasificar-categoria"
                className="mb-3 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
            >
                <option value="">Elija una categoría</option>
                {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                ))}
            </select>
            <label htmlFor="clasificar-nota" className="mb-1 block text-sm text-subtle">Motivo de la clasificación</label>
            <textarea
                id="clasificar-nota"
                data-testid="textarea-clasificar-nota"
                className="mb-1 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                rows={3}
                maxLength={2000}
                placeholder="Queda en la auditoría como el porqué de la decisión humana. Mínimo 10 caracteres."
                value={nota}
                onChange={(e) => setNota(e.target.value)}
            />
            <p className="mb-3 text-xs text-subtle">{nota.length} / 2000 caracteres</p>
            <p className="mb-3 text-sm text-subtle">
                Al asignar, el reporte pasa a clasificado y su visibilidad se recalcula según el score.
            </p>
            <Button onClick={onAsignar} disabled={loading || !asignacionListaParaEnviar(categoria, nota)}>
                {loading ? "Guardando..." : "Asignar clasificación"}
            </Button>
        </div>
    );
}

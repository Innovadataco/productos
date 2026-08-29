"use client";

/**
 * SPEC-224 (002-PI-125, FR-008): editor de regla — creación y edición con
 * preview del SQL, botón "Probar" que ejecuta el test en solo lectura contra
 * datos reales y verificación de variables de la plantilla contra las columnas
 * del resultado (advertencia no bloqueante, US-2 escenario 4). `clave` es
 * inmutable tras la creación (no editable en modo edición). La edición exige
 * motivo (versionado). La validación estática del SQL se repite siempre en el
 * servidor; este formulario nunca es la barrera.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alerta } from "@/components/ui/Alerta";
import { Badge } from "@/components/ui/Badge";

export interface ReglaDetallePanel {
    id: string;
    clave: string;
    nombre: string;
    descripcion: string;
    categoria: string;
    sqlQuery: string;
    plantillaRecomendacion: string;
    accionEjecutable: string | null;
    prioridad: number;
    frecuenciaMin: number;
    umbralMinimo: number | null;
    activa: boolean;
    version: number;
}

interface ResultadoTestPanel {
    columnas: string[];
    filas: Array<Record<string, unknown>>;
    filasMuestra: number;
    duracionMs: number;
    limitAplicado: number;
    timeoutMs: number;
}

interface ReglaEditorProps {
    /** null = creación; con valor = edición. */
    regla: ReglaDetallePanel | null;
    onGuardado: () => void;
    onCancelar: () => void;
}

const CATEGORIAS = ["renovacion", "churn", "crecimiento", "anomalia"] as const;
const ACCIONES = ["crear_bono_retencion", "enviar_notificacion", "asignar_a_operador", "crear_alerta_admin"] as const;

/** Variables {{variable}} de la plantilla (réplica cliente del helper puro). */
function variablesDe(plantilla: string): string[] {
    const variables = new Set<string>();
    for (const match of plantilla.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) {
        if (match[1]) variables.add(match[1]);
    }
    return [...variables];
}

export function ReglaEditor({ regla, onGuardado, onCancelar }: ReglaEditorProps) {
    const esEdicion = regla !== null;
    const [clave, setClave] = useState(regla?.clave ?? "");
    const [nombre, setNombre] = useState(regla?.nombre ?? "");
    const [descripcion, setDescripcion] = useState(regla?.descripcion ?? "");
    const [categoria, setCategoria] = useState(regla?.categoria ?? CATEGORIAS[0]);
    const [sqlQuery, setSqlQuery] = useState(regla?.sqlQuery ?? "");
    const [plantilla, setPlantilla] = useState(regla?.plantillaRecomendacion ?? "");
    const [prioridad, setPrioridad] = useState(regla?.prioridad ?? 50);
    const [frecuenciaMin, setFrecuenciaMin] = useState(regla?.frecuenciaMin ?? 60);
    const [umbralMinimo, setUmbralMinimo] = useState(regla?.umbralMinimo?.toString() ?? "");
    const [accionEjecutable, setAccionEjecutable] = useState(regla?.accionEjecutable ?? "");
    const [activa, setActiva] = useState(regla?.activa ?? true);
    const [motivo, setMotivo] = useState("");
    const [probando, setProbando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoTestPanel | null>(null);
    const [error, setError] = useState<string | null>(null);

    const variablesSinColumna = useMemo(() => {
        if (!resultado) return [];
        const columnas = new Set(resultado.columnas);
        return variablesDe(plantilla).filter((v) => !columnas.has(v));
    }, [resultado, plantilla]);

    async function probar() {
        setProbando(true);
        setError(null);
        setResultado(null);
        try {
            const respuesta = await fetch("/api/admin/analisis/reglas/test-sql", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sqlQuery, ...(regla ? { reglaId: regla.id } : {}) }),
            });
            const cuerpo = (await respuesta.json()) as ResultadoTestPanel & { error?: { message?: string } };
            if (!respuesta.ok) {
                setError(cuerpo.error?.message ?? "La consulta no se pudo probar");
                return;
            }
            setResultado(cuerpo);
        } catch {
            setError("Error de red al probar la consulta");
        } finally {
            setProbando(false);
        }
    }

    async function guardar() {
        setGuardando(true);
        setError(null);
        try {
            const base = {
                nombre,
                descripcion,
                categoria,
                sqlQuery,
                plantillaRecomendacion: plantilla,
                prioridad,
                frecuenciaMin,
                umbralMinimo: umbralMinimo.trim() === "" ? null : Number(umbralMinimo),
                accionEjecutable: accionEjecutable === "" ? null : accionEjecutable,
                accionParametros: null,
            };
            const respuesta = esEdicion
                ? await fetch(`/api/admin/analisis/reglas/${regla.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...base, activa, motivo: motivo.trim() }),
                })
                : await fetch("/api/admin/analisis/reglas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...base, clave }),
                });
            const cuerpo = (await respuesta.json()) as { error?: { message?: string } };
            if (!respuesta.ok) {
                setError(cuerpo.error?.message ?? "No se pudo guardar la regla");
                return;
            }
            onGuardado();
        } catch {
            setError("Error de red al guardar la regla");
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-body">
                {esEdicion ? `Editar regla · ${regla.clave} (v${regla.version})` : "Crear regla nueva"}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
                {!esEdicion && (
                    <Input
                        label="Clave (única, inmutable)"
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                        placeholder="test.vencimientos_7d"
                    />
                )}
                <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                <Input
                    label="Descripción"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                />
                <Select
                    label="Categoría"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
                />
                <Input
                    label="Prioridad (0-100)"
                    type="number"
                    min={0}
                    max={100}
                    value={prioridad}
                    onChange={(e) => setPrioridad(Number(e.target.value))}
                />
                <Input
                    label="Frecuencia (minutos, 5-10080)"
                    type="number"
                    min={5}
                    max={10080}
                    value={frecuenciaMin}
                    onChange={(e) => setFrecuenciaMin(Number(e.target.value))}
                />
                <Input
                    label="Umbral mínimo (opcional)"
                    type="number"
                    min={0}
                    value={umbralMinimo}
                    onChange={(e) => setUmbralMinimo(e.target.value)}
                />
                <Select
                    label="Acción ejecutable (opcional)"
                    value={accionEjecutable}
                    onChange={(e) => setAccionEjecutable(e.target.value)}
                    options={[
                        { value: "", label: "Sin acción (se comporta como Recomienda)" },
                        ...ACCIONES.map((a) => ({ value: a, label: a })),
                    ]}
                />
                {esEdicion && (
                    <Select
                        label="Estado"
                        value={activa ? "activa" : "inactiva"}
                        onChange={(e) => setActiva(e.target.value === "activa")}
                        options={[
                            { value: "activa", label: "Activa" },
                            { value: "inactiva", label: "Inactiva" },
                        ]}
                    />
                )}
            </div>
            <Textarea
                label="Consulta SQL (SELECT de una sola sentencia)"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={6}
                className="font-mono"
                placeholder={'SELECT s.id AS "suscripcionId" FROM "suscripciones" s WHERE s.estado = \'ACTIVA\''}
            />
            <Textarea
                label="Plantilla de la sugerencia (variables {{columna}})"
                value={plantilla}
                onChange={(e) => setPlantilla(e.target.value)}
                rows={3}
                placeholder="Llama a {{colegio}} · vence {{fechaFin}}"
            />
            <div className="flex items-center gap-3">
                <Button variant="outline" onClick={probar} isLoading={probando} disabled={sqlQuery.trim() === ""}>
                    Probar
                </Button>
                <span className="text-xs text-muted">
                    Ejecuta en solo lectura (máx 50 filas, 5 s) y registra solo metadatos en auditoría.
                </span>
            </div>
            {resultado && (
                <div className="space-y-3 rounded-xl border border-white/20 p-4">
                    <p className="text-sm text-body">
                        Muestra: <strong>{resultado.filasMuestra}</strong> filas · {resultado.duracionMs} ms ·
                        límite {resultado.limitAplicado} · timeout {resultado.timeoutMs} ms
                    </p>
                    {resultado.filas.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr>
                                        {resultado.columnas.map((c) => (
                                            <th key={c} className="px-2 py-1 text-left text-muted">
                                                {c}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {resultado.filas.slice(0, 10).map((fila, i) => (
                                        <tr key={i}>
                                            {resultado.columnas.map((c) => (
                                                <td key={c} className="px-2 py-1 text-body">
                                                    {String(fila[c] ?? "")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {resultado.filas.length > 10 && (
                                <p className="mt-1 text-xs text-muted">Se muestran 10 de {resultado.filas.length} filas.</p>
                            )}
                        </div>
                    )}
                    {variablesDe(plantilla).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted">Variables de la plantilla:</span>
                            {variablesDe(plantilla).map((v) =>
                                variablesSinColumna.includes(v) ? (
                                    <Badge key={v} variant="warning">
                                        {`{{${v}}} · sin columna`}
                                    </Badge>
                                ) : (
                                    <Badge key={v} variant="success">
                                        {`{{${v}}}`}
                                    </Badge>
                                )
                            )}
                        </div>
                    )}
                </div>
            )}
            {esEdicion && (
                <Textarea
                    label="Motivo del cambio (obligatorio, mínimo 10 caracteres; queda en el historial de versiones)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    placeholder="Por qué se ajusta esta regla"
                />
            )}
            {error && <Alerta tono="error">{error}</Alerta>}
            <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={onCancelar} disabled={guardando}>
                    Cancelar
                </Button>
                <Button onClick={guardar} isLoading={guardando}>
                    {esEdicion ? "Guardar cambios" : "Crear regla"}
                </Button>
            </div>
        </div>
    );
}

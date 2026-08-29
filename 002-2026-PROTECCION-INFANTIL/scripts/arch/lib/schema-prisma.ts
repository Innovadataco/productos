/**
 * SPEC-126 (D1): parser textual de `prisma/schema.prisma`. Sin BD, sin introspección:
 * bloques `model X { ... }`, campos y relaciones por línea. Determinista.
 */
import * as fs from "node:fs";

export interface CampoModelo {
    nombre: string;
    tipo: string;
    esLista: boolean;
    esOpcional: boolean;
    esUnico: boolean;
    esId: boolean;
    /** El tipo del campo es otro modelo del schema (relación, con o sin @relation explícito). */
    esRelacion: boolean;
    /** Lado portador de la FK: la línea lleva `@relation(fields: ...)`. */
    esLadoFk: boolean;
}

export interface ModeloInfo {
    nombre: string;
    campos: CampoModelo[];
}

export interface AristaER {
    padre: string;
    hijo: string;
    campoFk: string;
    cardinalidad: "1:1" | "1:N";
    fkOpcional: boolean;
}

export function parsearSchemaPrisma(rutaSchema: string): ModeloInfo[] {
    const texto = fs.readFileSync(rutaSchema, "utf-8");
    const modelos: ModeloInfo[] = [];
    const re = /^model\s+(\w+)\s*\{([^}]*)\}/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
        const campos: CampoModelo[] = [];
        for (const lineaCruda of m[2].split("\n")) {
            const linea = lineaCruda.trim();
            if (!linea || linea.startsWith("//") || linea.startsWith("@@")) continue;
            const partes = linea.split(/\s+/);
            if (partes.length < 2) continue;
            const [nombre, tipoCrudo] = partes;
            const esLista = tipoCrudo.endsWith("[]");
            const esOpcional = !esLista && tipoCrudo.endsWith("?");
            campos.push({
                nombre,
                tipo: tipoCrudo.replace(/\[\]$/, "").replace(/\?$/, ""),
                esLista,
                esOpcional,
                esUnico: linea.includes("@unique"),
                esId: linea.includes("@id"),
                esRelacion: false, // se resuelve abajo, cuando se conocen todos los modelos
                esLadoFk: linea.includes("@relation(fields:"),
            });
        }
        modelos.push({ nombre: m[1], campos });
    }
    const nombres = new Set(modelos.map((x) => x.nombre));
    for (const modelo of modelos) {
        for (const campo of modelo.campos) {
            campo.esRelacion = nombres.has(campo.tipo);
        }
    }
    return modelos;
}

/** Aristas del diagrama ER: una por cada FK (lado `@relation(fields: ...)`), orden estable. */
export function aristasER(modelos: ModeloInfo[]): AristaER[] {
    const aristas: AristaER[] = [];
    for (const modelo of modelos) {
        for (const campo of modelo.campos) {
            if (!campo.esLadoFk || !campo.esRelacion) continue;
            aristas.push({
                padre: campo.tipo,
                hijo: modelo.nombre,
                campoFk: campo.nombre,
                cardinalidad: campo.esUnico ? "1:1" : "1:N",
                fkOpcional: campo.esOpcional,
            });
        }
    }
    return aristas.sort(
        (a, b) =>
            a.padre.localeCompare(b.padre) ||
            a.hijo.localeCompare(b.hijo) ||
            a.campoFk.localeCompare(b.campoFk)
    );
}

/**
 * Huérfano (D8): sin campos-relación propios Y sin ser referenciado por el campo
 * de relación de ningún otro modelo (definición mecánica y simétrica).
 */
export function modelosHuerfanos(modelos: ModeloInfo[]): string[] {
    const referenciados = new Set<string>();
    for (const modelo of modelos) {
        for (const campo of modelo.campos) {
            if (campo.esRelacion && campo.tipo !== modelo.nombre) referenciados.add(campo.tipo);
        }
    }
    return modelos
        .filter((modelo) => !modelo.campos.some((c) => c.esRelacion) && !referenciados.has(modelo.nombre))
        .map((modelo) => modelo.nombre)
        .sort();
}

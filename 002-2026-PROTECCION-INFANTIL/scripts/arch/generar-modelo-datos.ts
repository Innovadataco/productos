/**
 * SPEC-126 · Generador de `docs/architecture/01-modelo-datos.md`.
 * Fuente: `prisma/schema.prisma` (parseo textual, sin BD) + `excepciones.json`.
 *
 * Contenido: modelos agrupados por dominio (regla declarativa abajo), diagrama ER
 * en Mermaid derivado de las FK (`@relation(fields: ...)`), sección de huérfanos
 * contrastada con la lista de excepciones y rótulo I-29 en IdentificadorReportado.
 *
 * Uso CLI: `npx tsx scripts/arch/generar-modelo-datos.ts` (escribe el artefacto).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ARTEFACTOS, encabezadoGenerado } from "./artefactos";
import { RUTA_DOCS_ARCH, RUTA_EXCEPCIONES, RUTA_SCHEMA } from "./lib/paths";
import { aristasER, modelosHuerfanos, parsearSchemaPrisma, type ModeloInfo } from "./lib/schema-prisma";

/**
 * Agrupación por dominio (research D7): reglas ordenadas por nombre de modelo,
 * primera que casa gana; lo que no casa cae en "Otros" (visible, nunca silenciado).
 */
const REGLAS_DOMINIO: Array<{ dominio: string; coincide: RegExp }> = [
    { dominio: "SaaS y facturación", coincide: /^(Tenant|Plan|Subscription|BillingCycle)$/ },
    { dominio: "Colegios (multi-tenant)", coincide: /^(Colegio|Curso|EstudianteObservacion|Estudiante|AcudienteEstudiante|IdentificadorEstudiante|Profesor|AlertaColegio)/ },
    { dominio: "Geografía", coincide: /^(Pais|Departamento|Ciudad)$/ },
    { dominio: "Catálogos", coincide: /^Plataforma$/ },
    {
        dominio: "Reportes y ciclo de vida",
        coincide: /^(Reporte|SolicitudComite|TransicionReporte|ReintentoReporte|PasoProcesamiento|FuenteReporte|IdentificadorReportado)/,
    },
    { dominio: "Apelaciones y disputas", coincide: /^(Apelacion|DocumentoApelacion|AccesoDocumentoApelacion)/ },
    { dominio: "Círculo de confianza y alertas", coincide: /^(ContactoConfianza|IdentificadorContacto|AlertaSuscripcion)/ },
    {
        dominio: "IA: clasificación, dataset y embeddings",
        coincide: /^(ClasificacionIA|CorreccionAdmin|DatasetEntrenamiento|EmbeddingDataset|EmbeddingReporte|ClasificacionRubricaVoto)/,
    },
    { dominio: "Simulación", coincide: /^(SimulacionRun|SimulacionReporte)/ },
    { dominio: "Permisos por módulo", coincide: /^(ModuloPermisible|PermisoModulo)/ },
    { dominio: "Usuarios y acceso", coincide: /^(Usuario|PerfilOperador|IntegranteComite|CodigoVerificacion|TokenRecuperacion)$/ },
    { dominio: "Plataforma: configuración, auditoría y límites", coincide: /^(ParametroSistema|AuditLog|RateLimit)$/ },
];

/** I-29: campos vivos en datos pero prohibidos de cara al usuario (lista declarativa). */
const CAMPOS_PROHIBIDOS_I29: Record<string, string[]> = {
    IdentificadorReportado: ["score", "scoreAnonimo", "scoreAutenticado", "scoreAjustado", "nivelRiesgo"],
};

function dominioDe(nombre: string): string {
    for (const regla of REGLAS_DOMINIO) {
        if (regla.coincide.test(nombre)) return regla.dominio;
    }
    return "Otros (sin regla de dominio)";
}

function fichaModelo(modelo: ModeloInfo): string[] {
    const prohibidos = new Set(CAMPOS_PROHIBIDOS_I29[modelo.nombre] ?? []);
    const lineas: string[] = [`#### \`${modelo.nombre}\``, "", "| Campo | Tipo | Atributos |", "| --- | --- | --- |"];
    for (const c of modelo.campos) {
        const attrs: string[] = [];
        if (c.esId) attrs.push("id");
        if (c.esUnico) attrs.push("único");
        if (c.esLista) attrs.push("lista");
        if (c.esOpcional) attrs.push("opcional");
        if (c.esRelacion) attrs.push(c.esLadoFk ? "relación (FK)" : "relación");
        if (prohibidos.has(c.nombre)) attrs.push("**vivo en datos, prohibido de cara al usuario (I-29)**");
        lineas.push(`| ${c.nombre} | ${c.tipo} | ${attrs.join(", ") || "—"} |`);
    }
    lineas.push("");
    return lineas;
}

export function generarModeloDatos(): string {
    const propio = ARTEFACTOS.find((a) => a.archivo === "01-modelo-datos.md")!;
    const modelos = parsearSchemaPrisma(RUTA_SCHEMA);
    const excepciones = JSON.parse(fs.readFileSync(RUTA_EXCEPCIONES, "utf-8")) as { huerfanosPermitidos: string[] };
    const huerfanos = modelosHuerfanos(modelos);
    const aristas = aristasER(modelos);

    const porDominio = new Map<string, ModeloInfo[]>();
    for (const modelo of modelos) {
        const dominio = dominioDe(modelo.nombre);
        porDominio.set(dominio, [...(porDominio.get(dominio) ?? []), modelo]);
    }
    const dominiosOrdenados = [...porDominio.keys()].sort((a, b) => a.localeCompare(b));

    const lineas: string[] = [
        encabezadoGenerado(propio.generador, propio.fuentes),
        "# 01 · Modelo de datos (Prisma)",
        "",
        `Total de modelos: **${modelos.length}** (parseo textual de \`prisma/schema.prisma\`, sin BD).`,
        "",
        "Regla de agrupación por dominio: lista ordenada de reglas por nombre de modelo",
        "(primera que casa gana), declarada en el generador; lo que no casa cae en «Otros».",
        "",
        "## Modelos por dominio",
        "",
    ];
    for (const dominio of dominiosOrdenados) {
        const delDominio = porDominio.get(dominio)!.sort((a, b) => a.nombre.localeCompare(b.nombre));
        lineas.push(`### ${dominio} (${delDominio.length})`, "");
        for (const modelo of delDominio) {
            lineas.push(...fichaModelo(modelo));
        }
    }

    lineas.push("## Diagrama ER (Mermaid)", "", "Derivado de las FK (`@relation(fields: ...)`); cardinalidad 1:1 si la FK es única.", "", "```mermaid", "erDiagram");
    for (const a of aristas) {
        const izq = a.cardinalidad === "1:1" ? "||--||" : "||--o{";
        const etiqueta = a.fkOpcional ? `${a.campoFk} (opcional)` : a.campoFk;
        lineas.push(`    ${a.padre} ${izq} ${a.hijo} : "${etiqueta}"`);
    }
    lineas.push("```", "");

    lineas.push(
        "## Huérfanos (sin relaciones entrantes ni salientes)",
        "",
        "Definición mecánica (research D8): sin campos-relación propios Y sin ser referenciado",
        "por ningún otro modelo. La lista de excepciones declarada vive en",
        "`scripts/arch/excepciones.json`; un huérfano nuevo fuera de ella pone `arch:check` en ROJO.",
        "",
        "| Modelo | ¿En excepciones declaradas? |",
        "| --- | --- |"
    );
    for (const h of huerfanos) {
        lineas.push(`| ${h} | ${excepciones.huerfanosPermitidos.includes(h) ? "sí" : "**NO — ROJO en arch:check**"} |`);
    }
    if (huerfanos.length === 0) lineas.push("| — | — |");
    lineas.push("");
    return lineas.join("\n");
}

function main() {
    const destino = path.join(RUTA_DOCS_ARCH, "01-modelo-datos.md");
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, generarModeloDatos());
    console.log(`[Arch:gen] ${destino} escrito.`);
}

if (process.argv[1]?.endsWith("generar-modelo-datos.ts")) {
    main();
}

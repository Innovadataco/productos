/**
 * SPEC-126: lista declarativa de los artefactos de la línea base de arquitectura.
 * Única fuente: añadir un artefacto = añadir una fila aquí (00-INDICE.md se regenera solo).
 * Los comandos se ejecutan desde la raíz del producto.
 */
export interface ArtefactoLineaBase {
    archivo: string;
    titulo: string;
    fuentes: string[];
    generador: string;
    /**
     * SPEC-432b: este artefacto es una TABLA a la que cada ruta nueva le agrega
     * una fila, así que dos ramas chocaban ahí sin excepción. Con `merge=union`
     * ya no chocan, pero union no garantiza el ORDEN de las dos filas nuevas.
     *
     * Con esta marca, `arch:check (a)` tolera el orden **dentro de cada tabla**
     * y sigue siendo estricto con todo lo demás: una fila que falta, que sobra,
     * que se repite o que salta de sección **es rojo**. Ver
     * `lib/comparar-tolerando-orden.ts`.
     */
    toleraOrdenDeFilas?: boolean;
    /**
     * SPEC-803: este artefacto es una FOTO del estado GLOBAL (índice, modelo de datos, stack).
     * Verificarlo byte a byte en cada PR obliga a cargar esa foto dentro de un cambio local, y las
     * fotos no componen: dos PR de schema en paralelo dejan `main` rojo y fuerzan un rebase por Dev.
     *
     * Con esta marca, el gate del PR verifica SOLO REPRESENTABILIDAD (que el generador corra sin
     * error sobre la fuente), NO `committed == regen`. El barrido post-merge (generados-post-merge)
     * los regenera sobre `main` y abre el PR del operador si driftearon. Mismo tratamiento que
     * `toleraOrdenDeFilas` da a 02/03, por otra razón: aquéllos por orden de filas; éstos por ser
     * una foto global que debe estar al día EVENTUALMENTE (tras el merge), no en cada PR.
     *
     * El aparato NO se quita: el generador SIGUE corriendo en el PR (representabilidad) y el drift
     * real lo caza el post-merge sobre `main`.
     */
    fueraDelGatePorPR?: boolean;
}

export const ARTEFACTOS: ArtefactoLineaBase[] = [
    {
        archivo: "00-INDICE.md",
        titulo: "Índice de la línea base",
        fuentes: ["scripts/arch/artefactos.ts"],
        generador: "scripts/arch/generar-indice.ts",
        fueraDelGatePorPR: true,
    },
    {
        archivo: "01-modelo-datos.md",
        titulo: "Modelo de datos (Prisma)",
        fuentes: ["prisma/schema.prisma", "scripts/arch/excepciones.json"],
        generador: "scripts/arch/generar-modelo-datos.ts",
        fueraDelGatePorPR: true,
    },
    {
        archivo: "02-roles-capacidades.md",
        titulo: "Roles y capacidades (puerta y permisos)",
        fuentes: [
            "src/lib/proxy.ts",
            "src/lib/nav-items.ts",
            "src/lib/permisos-catalogo.ts",
            "src/components/modules/NavHeader.tsx",
            "prisma/seed.ts",
            "src/app/**",
        ],
        generador: "scripts/arch/generar-roles-capacidades.ts",
        toleraOrdenDeFilas: true,
    },
    {
        archivo: "03-pantallas.md",
        titulo: "Pantallas por rol y transiciones",
        fuentes: ["src/app/**", "src/lib/proxy.ts", "src/lib/nav-items.ts"],
        generador: "scripts/arch/generar-pantallas.ts",
        toleraOrdenDeFilas: true,
    },
    {
        archivo: "06-stack.md",
        titulo: "Stack, contenedores y puertos",
        fuentes: ["package.json", "Dockerfile", "docker-compose.prod.yml", "docker-compose.yml"],
        generador: "scripts/arch/generar-stack.ts",
        fueraDelGatePorPR: true,
    },
];

/** Encabezado obligatorio de todo artefacto generado (sin timestamps: determinismo byte a byte). */
export function encabezadoGenerado(generador: string, fuentes: string[]): string {
    return [
        "> GENERADO por `" + generador + "` — no editar a mano.",
        "> Fuentes: " + fuentes.map((f) => "`" + f + "`").join(", ") + ".",
        "> Regenerar: `npx tsx " + generador + "` (o `npm run arch:check` para verificar).",
        "",
    ].join("\n");
}

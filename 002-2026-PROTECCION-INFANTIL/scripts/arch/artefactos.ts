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
}

export const ARTEFACTOS: ArtefactoLineaBase[] = [
    {
        archivo: "00-INDICE.md",
        titulo: "Índice de la línea base",
        fuentes: ["scripts/arch/artefactos.ts"],
        generador: "scripts/arch/generar-indice.ts",
    },
    {
        archivo: "01-modelo-datos.md",
        titulo: "Modelo de datos (Prisma)",
        fuentes: ["prisma/schema.prisma", "scripts/arch/excepciones.json"],
        generador: "scripts/arch/generar-modelo-datos.ts",
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

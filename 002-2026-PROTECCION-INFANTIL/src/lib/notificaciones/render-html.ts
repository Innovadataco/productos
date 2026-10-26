/**
 * SPEC-909 — Render de cuerpos de notificación: Markdown → HTML + respaldo de texto.
 *
 * Antes el motor enviaba SOLO `text:` con el Markdown crudo (`enviar-email.ts`), así
 * que `**negrita**` y los enlaces salían literales (asteriscos a la vista, sin botón;
 * Jelkin vio `**Colegio 1**`). Acá se convierte ese Markdown —ya con las variables
 * `{{..}}` sustituidas por `renderizarPlantilla`— a:
 *   - `html`: HTML con estilos EN LÍNEA (los clientes de correo ignoran `<style>` y
 *     las clases), SANEADO por construcción: se descarta TODO HTML crudo del origen y
 *     los `href` solo pueden ser http/https/mailto. Un enlace Markdown `[texto](url)`
 *     se pinta como BOTÓN primario; una URL autoenlazada queda como enlace en línea.
 *   - `texto`: respaldo en texto plano SIN `**` ni etiquetas (clientes sin HTML).
 *
 * Imports RELATIVOS a propósito: este módulo es alcanzable desde el worker de
 * notificaciones (vía `enviar-email.ts`), igual que su vecino (SPEC-197 · I-88 ·
 * anti-alias `@/lib/`). `marked` es una lib mantenida y sin dependencias de runtime.
 *
 * `envolverEnLayout` es la COSTURA del layout institucional de Diseño (encabezado /
 * botón / pie): hoy aplica un envoltorio estructural neutro y válido para correo, y
 * los estilos de marca viven en las constantes `ESTILO_*`. La forma definitiva de
 * Diseño entra por su SHA (vía CEO) tocando SOLO este archivo, nunca el motor.
 */
import { Marked, type RendererObject, type Tokens } from "marked";

// --- Estilos EN LÍNEA · única sede de la "forma" (costura para el SHA de Diseño) ---
const ESTILO_PARRAFO = "margin:0 0 16px;";
const ESTILO_ENLACE = "color:#1d4ed8;text-decoration:underline;";
const ESTILO_BOTON =
    "display:inline-block;margin:8px 0;padding:12px 22px;background:#1d4ed8;color:#ffffff;" +
    "text-decoration:none;border-radius:8px;font-weight:600;";
const ESTILO_LISTA = "margin:0 0 16px;padding-left:22px;";
const ESTILO_ITEM = "margin:0 0 6px;";
const ESTILO_TITULO = "margin:0 0 12px;font-weight:700;line-height:1.3;font-size:18px;";

/** Protocolos de enlace permitidos en un correo. Nada de `javascript:`/`data:`. */
function hrefSeguro(href: string): string | null {
    const limpio = (href || "").trim();
    if (/^https?:\/\//i.test(limpio)) return limpio;
    if (/^mailto:/i.test(limpio)) return limpio;
    return null;
}

function escaparHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Renderer de correo: estilos en línea, enlaces saneados, HTML crudo descartado.
 * Objeto `RendererObject` (no clase): marked lo mezcla sobre el renderer base y
 * liga `this` al renderer, de modo que `this.parser` rinde los hijos en línea.
 */
const rendererCorreo: RendererObject = {
    // Descarta TODO HTML crudo del origen (bloque e inline) → saneo por construcción.
    html(): string {
        return "";
    },

    paragraph(token: Tokens.Paragraph): string {
        return `<p style="${ESTILO_PARRAFO}">${this.parser.parseInline(token.tokens)}</p>`;
    },

    strong(token: Tokens.Strong): string {
        return `<strong style="font-weight:700;">${this.parser.parseInline(token.tokens)}</strong>`;
    },

    // Los correos no quieren `<h1>` gigantes: cualquier encabezado baja a párrafo con peso.
    heading(token: Tokens.Heading): string {
        return `<p style="${ESTILO_TITULO}">${this.parser.parseInline(token.tokens)}</p>`;
    },

    list(token: Tokens.List): string {
        const tag = token.ordered ? "ol" : "ul";
        const items = token.items.map((item) => this.listitem(item)).join("");
        return `<${tag} style="${ESTILO_LISTA}">${items}</${tag}>`;
    },

    listitem(token: Tokens.ListItem): string {
        // Ítem suelto (loose) trae bloques; ítem apretado trae en línea. `parse` cubre ambos.
        const contenido = token.loose ? this.parser.parse(token.tokens) : this.parser.parseInline(token.tokens);
        return `<li style="${ESTILO_ITEM}">${contenido}</li>`;
    },

    link(token: Tokens.Link): string {
        const href = hrefSeguro(token.href);
        const contenido = this.parser.parseInline(token.tokens);
        if (!href) return contenido; // protocolo no permitido → se conserva solo el texto
        // `[texto](url)` explícito → BOTÓN primario; URL autoenlazada → enlace en línea.
        const esExplicito = token.raw.trimStart().startsWith("[");
        if (esExplicito) {
            return `<a href="${escaparHtml(href)}" data-rol="boton-primario" style="${ESTILO_BOTON}">${contenido}</a>`;
        }
        return `<a href="${escaparHtml(href)}" style="${ESTILO_ENLACE}">${contenido}</a>`;
    },
};

// Instancia aislada (no muta el singleton global de `marked`). El renderer va por el
// constructor COMO OBJETO PLANO: marked lo mezcla sobre el base (conserva `em`, `br`,
// etc.) — una instancia de clase no se mezclaría (métodos no enumerables). `breaks:true`:
// un solo `\n` → `<br>` (las plantillas ponen la URL en la línea siguiente al texto).
const MARKED_CORREO = new Marked({ gfm: true, breaks: true, renderer: rendererCorreo });

/** Markdown → HTML interno (sin el envoltorio de layout), con estilos en línea y saneado. */
export function markdownAHtml(cuerpoMarkdown: string): string {
    return MARKED_CORREO.parse(cuerpoMarkdown ?? "", { async: false }) as string;
}

/**
 * Markdown → texto plano de respaldo: SIN `**`/`__`, SIN etiquetas, enlaces como
 * `texto (url)`. No busca ser un renderer perfecto; busca ser legible y sin sintaxis.
 */
export function markdownATextoPlano(cuerpoMarkdown: string): string {
    let t = cuerpoMarkdown ?? "";
    t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1"); // imágenes ![alt](url) → alt
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"); // enlaces [texto](url) → texto (url)
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1"); // negrita → texto
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2"); // itálica *x* → x (sin tocar ** ya resuelto)
    t = t.replace(/`([^`]+)`/g, "$1"); // código `x` → x
    t = t.replace(/^\s{0,3}#{1,6}\s+/gm, ""); // encabezados
    t = t.replace(/^\s{0,3}>\s?/gm, ""); // citas
    t = t.replace(/<[^>]+>/g, ""); // etiquetas HTML crudas
    t = t.replace(/\n{3,}/g, "\n\n"); // colapsar saltos de más
    return t.trim();
}

/**
 * COSTURA del layout institucional (Diseño, vía SHA del CEO). Hoy: envoltorio
 * estructural neutro y válido para correo (doctype, charset, viewport, contenedor
 * legible de ~600px). NO inventa marca (logo, encabezado, pie, colores de marca):
 * eso llega por el SHA de Diseño y entra SOLO acá y en las constantes `ESTILO_*`.
 */
export function envolverEnLayout(htmlInterno: string, opciones: { asunto?: string | null } = {}): string {
    const titulo = escaparHtml(opciones.asunto ?? "Protección Infantil");
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;font-size:16px;line-height:1.6;">
${htmlInterno}
</div>
</body>
</html>`;
}

/**
 * Punto único que usa `enviar-email.ts`: del Markdown (ya con variables sustituidas)
 * a `{ html, texto }` listos para Resend (`html:` + `text:` de respaldo).
 */
export function renderizarEmail(
    cuerpoMarkdown: string,
    opciones: { asunto?: string | null } = {}
): { html: string; texto: string } {
    return {
        html: envolverEnLayout(markdownAHtml(cuerpoMarkdown), { asunto: opciones.asunto ?? null }),
        texto: markdownATextoPlano(cuerpoMarkdown),
    };
}

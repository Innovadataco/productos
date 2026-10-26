/**
 * SPEC-909 — Render de cuerpos de notificación: Markdown → HTML + respaldo de texto.
 *
 * Antes el motor enviaba SOLO `text:` con el Markdown crudo (`enviar-email.ts`), así
 * que `**negrita**` y los enlaces salían literales (Jelkin vio `**Colegio 1**`). Acá se
 * convierte ese Markdown —ya con las variables `{{..}}` sustituidas por
 * `renderizarPlantilla`— a `{ html, texto }` listos para Resend.
 *
 * FORMA institucional: Diseño · SHA Gestión `446e8dc2`
 * (`…/SISTEMA-DE-DISENO/FORMA-CORREO-INSTITUCIONAL-Y-INVITACIONES-2026-10-26.md`).
 *   - §1.1 email-safe: tema CLARO único, estilos EN LÍNEA, tablas, ancho 600px, sin
 *     fuentes propias / sin CSS vars / sin dark mode.
 *   - §1.3 tokens → HEX (abajo). El **acento es un SLOT/parámetro** (pino para
 *     colegio/comité/institucional por defecto; cielo/ámbar para padre/IDC) — NO se
 *     hardcodea pino en el layout, se pasa.
 *   - §1.7 botón "a prueba de balas" (+ fallback VML para Outlook): un `[texto](url)`
 *     **a solas en su párrafo** → BOTÓN; un `[texto](url)` inline → enlace de texto.
 *   - §1.8 esqueleto (encabezado wordmark + cuerpo + pie con habeas data).
 *   - §3 saneo: se descarta TODO HTML crudo del origen y los `href` solo http/https/mailto.
 *
 * Imports RELATIVOS a propósito: este módulo es alcanzable desde el worker de
 * notificaciones (vía `enviar-email.ts`), igual que su vecino (SPEC-197 · I-88 ·
 * anti-alias `@/lib/`). `marked` es una lib mantenida y sin dependencias de runtime.
 */
import { Marked, type RendererObject, type Tokens } from "marked";

// --- Tokens de email §1.3 (HEX, tema claro único) ---
const PAPEL = "#eef1ef"; // fondo de la página
const SURFACE = "#ffffff"; // tarjeta
const TINTA = "#0f1815"; // texto principal
const TINTA_MUTED = "#4d5552"; // texto secundario / pie
const LINEA = "#e2e6e4"; // divisorias
// Acento = SLOT (§1.3). Defecto pino (protección/institucional: colegio+comité). Parámetro, NO hardcode.
export const ACENTO_PINO = "#0b6e5a";
const TEXTO_SOBRE_ACENTO = "#ffffff";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const SOPORTE_EMAIL = "gerencia@innovadataco.com";

/** Protocolos de enlace permitidos en un correo (§3 saneo). Nada de `javascript:`/`data:`. */
function hrefSeguro(href: string): string | null {
    const limpio = (href || "").trim();
    if (/^https?:\/\//i.test(limpio)) return limpio;
    if (/^mailto:/i.test(limpio)) return limpio;
    return null;
}

function escaparHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function quitarTags(s: string): string {
    return s.replace(/<[^>]+>/g, "");
}

/**
 * Botón "a prueba de balas" §1.7 + fallback VML (Outlook de escritorio). El `acento`
 * es el fondo (parametrizado). El alto efectivo ≥48px por el padding 15px.
 */
function botonHtml(href: string, etiquetaHtml: string, acento: string): string {
    const hrefSafe = escaparHtml(href);
    const etiquetaTexto = quitarTags(etiquetaHtml);
    const anchoVml = Math.max(180, etiquetaTexto.length * 10 + 56);
    const vml = `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${hrefSafe}" style="height:48px;v-text-anchor:middle;width:${anchoVml}px;" arcsize="25%" strokecolor="${acento}" fillcolor="${acento}"><w:anchorlock/><center style="color:${TEXTO_SOBRE_ACENTO};font-family:${SANS};font-size:16px;font-weight:600;">${etiquetaTexto}</center></v:roundrect><![endif]-->`;
    const anchor = `<a href="${hrefSafe}" style="display:inline-block;background:${acento};color:${TEXTO_SOBRE_ACENTO};text-decoration:none;font-weight:600;font-size:16px;line-height:1;padding:15px 28px;border-radius:12px;font-family:${SANS};">${etiquetaHtml}</a>`;
    return `${vml}<!--[if !mso]><!-- -->${anchor}<!--<![endif]-->`;
}

/** Devuelve el token de enlace si el párrafo es SOLO un enlace Markdown explícito (CTA → botón). */
function enlaceSoloDelParrafo(token: Tokens.Paragraph): Tokens.Link | null {
    const significativos = token.tokens.filter(
        (t) => !(t.type === "text" && !(t as Tokens.Text).raw.trim())
    );
    if (significativos.length === 1 && significativos[0].type === "link") {
        const lk = significativos[0] as Tokens.Link;
        if (lk.raw.trimStart().startsWith("[")) return lk; // explícito, no autolink
    }
    return null;
}

/**
 * Renderer de correo (objeto plano → marked lo mezcla sobre el base). Estilos en línea,
 * enlaces saneados, HTML crudo descartado, botón por `acento`. Cerrado sobre `acento`
 * (§1.3 slot): el mismo motor sirve a colegio/comité (pino) o a futuras audiencias.
 */
function rendererCorreo(acento: string): RendererObject {
    return {
        // Descarta TODO HTML crudo del origen (bloque e inline) → saneo por construcción.
        html(): string {
            return "";
        },
        paragraph(token: Tokens.Paragraph): string {
            const enlaceSolo = enlaceSoloDelParrafo(token);
            if (enlaceSolo) {
                const href = hrefSeguro(enlaceSolo.href);
                if (href) {
                    // `[texto](url)` a solas en su párrafo → BOTÓN §1.7.
                    const etiqueta = this.parser.parseInline(enlaceSolo.tokens);
                    return `<p style="margin:0 0 16px">${botonHtml(href, etiqueta, acento)}</p>`;
                }
            }
            return `<p style="margin:0 0 16px">${this.parser.parseInline(token.tokens)}</p>`;
        },
        // Encabezados Markdown → titular serif (§1.2/§1.4). El copy de invitación no los usa.
        heading(token: Tokens.Heading): string {
            return `<p style="margin:0 0 16px;font-family:${SERIF};font-size:22px;line-height:1.2;color:${TINTA};">${this.parser.parseInline(token.tokens)}</p>`;
        },
        list(token: Tokens.List): string {
            const tag = token.ordered ? "ol" : "ul";
            const items = token.items.map((item) => this.listitem(item)).join("");
            return `<${tag} style="margin:0 0 16px;padding-left:22px">${items}</${tag}>`;
        },
        listitem(token: Tokens.ListItem): string {
            const contenido = token.loose ? this.parser.parse(token.tokens) : this.parser.parseInline(token.tokens);
            return `<li style="margin:0 0 6px">${contenido}</li>`;
        },
        // Enlace INLINE (el standalone ya lo intercepta `paragraph` → botón): enlace de texto (§3).
        link(token: Tokens.Link): string {
            const href = hrefSeguro(token.href);
            const contenido = this.parser.parseInline(token.tokens);
            if (!href) return contenido; // protocolo no permitido → solo el texto
            return `<a href="${escaparHtml(href)}" style="color:${acento};text-decoration:underline;">${contenido}</a>`;
        },
    };
}

// Instancias aisladas por acento (no mutan el singleton global de `marked`). El renderer
// va por el constructor COMO OBJETO PLANO: marked lo mezcla sobre el base (conserva `em`,
// `br`, etc.). `breaks:true`: un solo `\n` → `<br>`.
const cacheMarked = new Map<string, Marked>();
function markedParaAcento(acento: string): Marked {
    let m = cacheMarked.get(acento);
    if (!m) {
        m = new Marked({ gfm: true, breaks: true, renderer: rendererCorreo(acento) });
        cacheMarked.set(acento, m);
    }
    return m;
}

/** Markdown → HTML interno del cuerpo (sin el layout). `acento` = slot §1.3 (defecto pino). */
export function markdownAHtml(cuerpoMarkdown: string, acento: string = ACENTO_PINO): string {
    return markedParaAcento(acento).parse(cuerpoMarkdown ?? "", { async: false }) as string;
}

/**
 * Markdown → texto plano de respaldo (§3): SIN `**`/`__`, SIN etiquetas, con la URL CRUDA
 * (`texto (url)`) para clientes sin HTML. No es un renderer perfecto; es legible y sin sintaxis.
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
 * Layout institucional §1.8 (email-safe: tablas, 600px, inline, tema claro). El acento es
 * un SLOT §1.3 (defecto pino): tiñe el pie y —vía `markdownAHtml`— el botón. `cuerpoHtml`
 * es el Markdown ya renderado que entra en la celda del cuerpo.
 */
export function envolverEnLayout(
    cuerpoHtml: string,
    opciones: { asunto?: string | null; acento?: string } = {}
): string {
    const acento = opciones.acento ?? ACENTO_PINO;
    const titulo = escaparHtml(opciones.asunto ?? "Protección Infantil");
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${titulo}</title></head>
<body style="margin:0;background:${PAPEL};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};">
 <tr><td align="center" style="padding:24px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${SURFACE};border:1px solid ${LINEA};border-radius:16px;overflow:hidden;">
   <tr><td style="padding:28px 32px;border-bottom:1px solid ${LINEA};font-family:${SERIF};font-size:20px;color:${TINTA};">Protección&nbsp;Infantil</td></tr>
   <tr><td style="padding:32px;font-family:${SANS};font-size:16px;line-height:1.6;color:${TINTA};">${cuerpoHtml}</td></tr>
   <tr><td style="padding:24px 32px;border-top:1px solid ${LINEA};font-family:${SANS};font-size:13px;line-height:1.5;color:${TINTA_MUTED};">Protección Infantil ayuda a las instituciones a detectar y actuar ante riesgos para sus estudiantes.<br />¿Dudas? Escríbanos a <a href="mailto:${SOPORTE_EMAIL}" style="color:${acento};">${SOPORTE_EMAIL}</a>.<br />Tratamos sus datos conforme a la Ley 1581 de 2012 (habeas data). Si usted no esperaba este correo, puede ignorarlo.</td></tr>
  </table>
 </td></tr>
</table>
</body></html>`;
}

/**
 * Punto único que usa `enviar-email.ts`: del Markdown (ya con variables sustituidas) a
 * `{ html, texto }` para Resend (`html:` + `text:` de respaldo). `acento` = slot §1.3.
 */
export function renderizarEmail(
    cuerpoMarkdown: string,
    opciones: { asunto?: string | null; acento?: string } = {}
): { html: string; texto: string } {
    const acento = opciones.acento ?? ACENTO_PINO;
    return {
        html: envolverEnLayout(markdownAHtml(cuerpoMarkdown, acento), { asunto: opciones.asunto ?? null, acento }),
        texto: markdownATextoPlano(cuerpoMarkdown),
    };
}

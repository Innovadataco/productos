/**
 * SPEC-617 (I-371 · D-131) · PUENTE SAME-SITE para el retorno de Google.
 *
 * El problema: el JWT de sesión es `SameSite=Strict` (a propósito, protege la bitácora de auditoría de
 * GET cross-site — ver `session-cookie-attrs.ts`). El retorno de Google es una navegación TOP-LEVEL
 * CROSS-SITE; un `302` del callback al destino HEREDA ese origen cross-site → el navegador NO manda el
 * JWT recién sellado → el Paso 2 del middleware no lo ve → /login. (Esa era la firma de I-371.)
 *
 * El puente: en vez de redirigir (302, cross-site), el callback devuelve esta PÁGINA (200, MISMO
 * ORIGEN) que navega ella misma al destino. Como la navegación la INICIA un documento de nuestro
 * propio origen, es SAME-SITE → el JWT Strict SÍ viaja → el middleware lo ve y sirve el home del rol.
 * No se afloja ninguna cookie y no se abre ninguna superficie GET cross-site.
 *
 * Se navega con `<meta http-equiv="refresh">` (no JS → no choca con la CSP con nonce; y sin JS no hay
 * umbral posible, así que la marca pinta desde el primer píxel, no tras un `hold`). NO hay redirector
 * abierto: el `destino` lo deriva el callback del ROL recién autenticado (homeParaRol), en el servidor,
 * NUNCA de un parámetro de la URL. Y JAMÁS enlaza a `/login`: el puente SOSTIENE (regla de Diseño).
 */
import { NextResponse } from "next/server";

/** Escapa para un contexto de atributo HTML entre comillas dobles. */
function escaparAtributo(valor: string): string {
    return valor
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/'/g, "&#39;");
}

/**
 * Origen público del puente, ESTRICTO. `NEXT_PUBLIC_APP_URL` es el canalón canónico; si falta o no es
 * una URL absoluta, ABORTA ruidoso en vez de caer a `request.url` — que dentro de Docker refleja el
 * host interno del contenedor (0.0.0.0:3000) y mandaría el aterrizaje a la nada SIN error (I-361). El
 * puente es la pieza que menos puede permitirse una degradación silenciosa. (Candado: ejercita la
 * ausencia, patrón de SPEC-612.)
 */
export function origenPublicoPuente(): string {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    let url: URL | null = null;
    try {
        url = raw ? new URL(raw) : null;
    } catch {
        url = null;
    }
    if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
        throw new Error(
            "[puente-oauth] NEXT_PUBLIC_APP_URL falta o no es una URL absoluta. El puente NO cae a " +
                "request.url (el host interno del contenedor, 0.0.0.0:3000) porque sería un aterrizaje " +
                "roto sin error (I-361). Configurá NEXT_PUBLIC_APP_URL con el origen público.",
        );
    }
    return url.origin;
}

/**
 * HTML del puente: navega al `destino` (una URL/ruta de NUESTRO origen, derivada del rol en el
 * servidor) vía meta-refresh. Puro y testeable sin red ni base.
 *
 * Forma (Diseño, tres reglas): (1) el FONDO `papel` del sistema pinta desde el PRIMER PÍXEL → una
 * conexión lenta nunca ve un flash en blanco tras autorizar con Google; (2) JAMÁS /login: el único
 * enlace es el home del rol, el puente SOSTIENE (con candado); (3) el CONTENIDO (escudo del Guardián +
 * «Entrando a tu cuenta…») se revela DIFERIDO a ~300 ms (animación CSS pura): un hold de menos de
 * 300 ms no tranquiliza, PARPADEA; en el camino instantáneo el meta-refresh navega antes y el contenido
 * nunca aparece, en el lento entra calmo. El aterrizaje en Inicio, saludando al padre, ES la
 * confirmación. Estilo inline-crítico (CSP: `style-src 'self' 'unsafe-inline'`), sin CSS/fuentes externas.
 * Tipografía `Georgia, serif` A SECAS (websafe, instantánea) — NO `var(--font-instrument-serif)`: si esa
 * var resolviera tarde, el texto SALTARÍA de fuente, un parpadeo en una pantalla de menos de un segundo.
 */
export function htmlPuenteAterrizaje(destino: string): string {
    const d = escaparAtributo(destino);
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${d}">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Entrando…</title>
<style>
html,body{margin:0;height:100%}
body{background:#eef1ef;color:#0f1815;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center}
@media(prefers-color-scheme:dark){body{background:#060b0a;color:#e7eae8}}
.puente{display:flex;flex-direction:column;align-items:center;gap:1rem;text-align:center;padding:2rem;opacity:0;animation:entrar .2s ease 300ms forwards}
@keyframes entrar{to{opacity:1}}
@media(prefers-reduced-motion:reduce){.puente{animation-duration:0s}}
.escudo{fill:#0b6e5a}
@media(prefers-color-scheme:dark){.escudo{fill:#4fe0b8}}
.msj{margin:0;font-size:1.15rem;font-weight:500}
.link{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:.85rem;color:#0b6e5a;text-decoration:none}
@media(prefers-color-scheme:dark){.link{color:#4fe0b8;opacity:.75}}
.link:hover{opacity:1;text-decoration:underline}
</style>
</head>
<body>
<div class="puente">
<svg viewBox="0 0 100 100" role="img" aria-label="Protección Infantil" width="60" height="60">
<defs><mask id="pi-hueco"><rect width="100" height="100" fill="#fff"/><g fill="#000"><circle cx="50" cy="44" r="7"/><path d="M50 53c-7.2 0-12.7 5.3-12.7 12.5v6.2c0 1.2 1 2.2 2.2 2.2h21c1.2 0 2.2-1 2.2-2.2v-6.2C62.7 58.3 57.2 53 50 53Z"/></g></mask></defs>
<path class="escudo" mask="url(#pi-hueco)" d="M50 8 82 20v29C82 69.4 68.4 85.6 50 91 31.6 85.6 18 69.4 18 49V20L50 8Z"/>
</svg>
<p class="msj">Entrando a tu cuenta…</p>
<a class="link" href="${d}">continúa aquí</a>
</div>
</body>
</html>`;
}

/**
 * Respuesta del puente: 200 text/html, sin caché (es un aterrizaje de sesión de un solo uso). El
 * callback le pega encima sus cookies (borrado del state, sellado de sesion_estado) y el JWT ya
 * sellado por `setSessionCookie`. Es un `NextResponse`, así que `res.cookies.set(...)` sigue igual.
 */
export function construirAterrizajeOAuth(destino: string): NextResponse {
    return new NextResponse(htmlPuenteAterrizaje(destino), {
        status: 200,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
        },
    });
}

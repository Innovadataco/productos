/**
 * SPEC-440 (I-306 · Jelkin vivo 04-09) · Candado permanente: la presentación
 * del padre y la urgencia NUNCA viajan en la URL del área del profesional.
 *
 * El defecto original: `?u=ESTA_SEMANA&pres=Soy+Jelkin+Zair+Carrillo+Franco…
 * con+mi+2+hijos+de+14+y+16+años`. Nombre completo del padre y edades de
 * los menores en la barra de direcciones, historial e ID logs. Regla de la
 * casa: PII va en cuerpo o estado de sesión.
 *
 * El ratchet escanea las páginas y componentes del área del padre y falla
 * si aparece:
 *  · `q.set("pres"` / `q.set("u"` — armar query con esas claves.
 *  · `?pres=` / `?u=` en un string literal (redirección o link).
 * Los comentarios y estos propios tests están permitidos (`sinComentarios`).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTAS_ESCANEADAS = [
    // Formularios y componentes del flujo del padre → profesional.
    path.resolve(__dirname, "../../components/modules/padre/profesionales/PresentacionUrgenciaForm.tsx"),
    path.resolve(__dirname, "../../components/modules/padre/profesionales/DirectorioProfesionales.tsx"),
    path.resolve(__dirname, "../../components/modules/padre/profesionales/ProfesionalPerfil.tsx"),
    path.resolve(__dirname, "../../components/modules/padre/profesionales/ProfesionalTarjeta.tsx"),
    // Server pages del mismo flujo.
    path.resolve(__dirname, "../../app/dashboard/padre/profesionales/page.tsx"),
    path.resolve(__dirname, "../../app/dashboard/padre/profesionales/directorio/page.tsx"),
    path.resolve(__dirname, "../../app/dashboard/padre/profesionales/[id]/page.tsx"),
];

function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const PATRONES_URL_PII: Array<{ patron: RegExp; motivo: string }> = [
    // `q.set("pres", …)` y `q.set("u", …)`.
    { patron: /\.set\(["']pres["']/, motivo: "presentación del padre en URL" },
    { patron: /\.set\(["']u["']/, motivo: "urgencia en URL (PII cuando acompaña presentación)" },
    // `new URLSearchParams({ pres: …, u: … })` — literal de objeto.
    { patron: /URLSearchParams\([^)]*\bpres\s*:/, motivo: "presentación en URLSearchParams object" },
    { patron: /URLSearchParams\([^)]*\bu\s*:/, motivo: "urgencia en URLSearchParams object" },
    // Strings literales con la query.
    { patron: /["']\?pres=/, motivo: "string con ?pres= (redirect o link)" },
    { patron: /["']\?u=/, motivo: "string con ?u= (redirect o link)" },
    { patron: /["']&pres=/, motivo: "string con &pres=" },
    { patron: /["']&u=/, motivo: "string con &u=" },
    // Server component tipando searchParams para recibirlas.
    { patron: /searchParams:.*\bpres\?/, motivo: "server component recibe `pres` por URL" },
    { patron: /searchParams:.*\bu\?/, motivo: "server component recibe `u` por URL" },
];

describe("SPEC-440 · candado permanente: presentación/urgencia fuera de la URL", () => {
    it("todas las rutas escaneadas existen (contraprueba del ratchet)", () => {
        const faltantes = RUTAS_ESCANEADAS.filter((r) => !fs.existsSync(r));
        expect(faltantes, `rutas ausentes: ${faltantes.join(", ")}`).toEqual([]);
    });

    it("ningún componente ni page del flujo escribe `pres`/`u` en la URL", () => {
        const violaciones: string[] = [];
        for (const ruta of RUTAS_ESCANEADAS) {
            const codigo = sinComentarios(fs.readFileSync(ruta, "utf-8"));
            for (const { patron, motivo } of PATRONES_URL_PII) {
                const m = codigo.match(patron);
                if (m) {
                    const rel = path.relative(path.resolve(__dirname, "../../.."), ruta);
                    violaciones.push(`${rel}: «${m[0]}» — ${motivo}`);
                }
            }
        }
        expect(
            violaciones,
            [
                "SPEC-440 (I-306) — PII del padre en la URL:",
                ...violaciones,
                "",
                "La presentación y la urgencia viven en `sessionStorage` (helper",
                "`borrador-consulta`). La URL solo puede llevar IDs opacos",
                "(`expedienteId`, `heredarDe`). Ver comentario del helper.",
            ].join("\n"),
        ).toEqual([]);
    });
});

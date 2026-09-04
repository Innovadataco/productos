/**
 * SPEC-436 · candados de los documentos del profesional — sin BD.
 *
 * El defecto que cierra esta spec no era un error de lógica: era una función
 * **sin llamador**. `leerAutorizacion` descifraba el archivo y nadie la
 * invocaba, así que la capacidad de leer el documento nunca existió, con el
 * botón «Descargar autorización firmada» prometiéndola en pantalla.
 *
 * Estos candados vigilan CONDUCTA/cableado, no menciones: cada uno muere si se
 * reintroduce el defecto, y lleva su contraprueba.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../..");

/** Quita comentarios: una llamada COMENTADA no es un llamador. */
function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Todo el código de producción bajo src/, sin tests y sin comentarios. */
function fuenteProductiva(excluir: string[] = []): Array<{ rel: string; codigo: string }> {
    const out: Array<{ rel: string; codigo: string }> = [];
    const rec = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const r = path.join(dir, e.name);
            if (e.isDirectory()) rec(r);
            else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
                const rel = path.relative(RAIZ, r);
                if (excluir.some((x) => rel.endsWith(x))) continue;
                out.push({ rel, codigo: sinComentarios(fs.readFileSync(r, "utf-8")) });
            }
        }
    };
    rec(path.join(RAIZ, "src"));
    return out;
}

describe("SPEC-436 · `leerAutorizacion` deja de ser código muerto", () => {
    it("alguien la LLAMA de verdad, fuera del módulo que la define", () => {
        // Se excluye su propio archivo: definirla no es usarla.
        const llamadores = fuenteProductiva(["profesional/autorizacion-storage.ts"])
            .filter(({ codigo }) => /\bleerAutorizacion\s*\(/.test(codigo))
            .map(({ rel }) => rel);
        expect(
            llamadores,
            "si nadie la llama, el documento vuelve a ser ilegible y el botón miente",
        ).not.toEqual([]);
    });

    it("CONTRAPRUEBA · una llamada comentada NO cuenta como llamador", () => {
        const comentado = sinComentarios("// await leerAutorizacion(id);\nconst x = 1;");
        expect(/\bleerAutorizacion\s*\(/.test(comentado)).toBe(false);
        const real = sinComentarios("const b = await leerAutorizacion(id);");
        expect(/\bleerAutorizacion\s*\(/.test(real)).toBe(true);
    });
});

describe("SPEC-436 · el enlace del documento no vuelve a ser el id crudo", () => {
    const ficha = sinComentarios(
        fs.readFileSync(
            path.join(RAIZ, "src/components/modules/verificacion/FichaVerificacionClient.tsx"),
            "utf-8",
        ),
    );

    it("el href apunta al endpoint que sirve, no al identificador del archivo", () => {
        // El defecto original: `href={ficha.autorizacionArchivoId}` — el navegador
        // lo resolvía relativo a la página y caía en 404.
        expect(ficha).not.toMatch(/href=\{\s*ficha\.autorizacionArchivoId\s*\}/);
        expect(ficha).toContain("/documentos/autorizacion");
    });

    it("CONTRAPRUEBA · la forma vieja del href se detecta", () => {
        const viejo = "href={ficha.autorizacionArchivoId}";
        expect(/href=\{\s*ficha\.autorizacionArchivoId\s*\}/.test(viejo)).toBe(true);
    });
});

describe("SPEC-436 · el documento se sirve auditado y nunca crudo", () => {
    const servicio = sinComentarios(
        fs.readFileSync(path.join(RAIZ, "src/lib/profesional/documentos.service.ts"), "utf-8"),
    );

    it("la auditoría se escribe ANTES de devolver el contenido", () => {
        const iAudit = servicio.indexOf('accion: "PROFESIONAL_AUTORIZACION_ACCESO"');
        const iReturn = servicio.indexOf("return {\n        buffer,");
        expect(iAudit, "sin auditoría no hay reserva legal defendible").toBeGreaterThan(-1);
        expect(iReturn).toBeGreaterThan(-1);
        expect(iAudit, "auditar después de servir deja aperturas sin rastro").toBeLessThan(iReturn);
    });

    it("no se expone la ruta en disco ni se sirve el cifrado", () => {
        // `rutaAutorizacion` construye la ruta del `.enc`: no puede salir por acá.
        expect(servicio).not.toContain("rutaAutorizacion");
        expect(servicio).toContain("leerAutorizacion");
    });

    it("el Content-Type sale del CONTENIDO, no de la columna guardada", () => {
        // Un dato guardado puede mentir (y para la autorización ni siquiera se
        // guardó nunca la extensión); el número mágico del archivo no miente.
        const i = servicio.indexOf("export async function servirDocumento");
        const cuerpo = servicio.slice(i);
        expect(cuerpo).toContain("validarAutorizacion(buffer)");
    });
});

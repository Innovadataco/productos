/**
 * SPEC-447 (I-311) · candado de la CLASE que causó esto.
 *
 * `POST /api/profesional/franjas` existe desde SPEC-395 (L4), funciona, tiene
 * su guardia de rol y su validación… y **nunca tuvo una pantalla que lo
 * llamara**. En producción `FranjaDisponible` estuvo en **0 filas toda su
 * historia**: el profesional no podía publicar disponibilidad y, por lo tanto,
 * ninguna familia podía agendar. Era la segunda causa —independiente de I-310—
 * de que `SolicitudCita` estuviera en cero.
 *
 * **Ningún candado de llamador lo habría cazado**, porque el hueco no estaba en
 * el cableado entre módulos: la ruta no la llama otro módulo, la llama **la
 * interfaz**. Por eso este candado mira `src/app/**` y `src/components/**`
 * buscando quién le pega al endpoint, y no un `import`.
 *
 * Y mira el terreno completo a propósito — la lección del falso positivo de
 * SPEC-439: una conclusión sobre código muerto solo vale si el barrido recorrió
 * de verdad todo lo que la conclusión afirma.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../..");

/** Todo lo que es interfaz: pantallas y componentes, sin tests ni rutas de API. */
function archivosDeInterfaz(): string[] {
    const salida: string[] = [];
    const recorrer = (dir: string) => {
        for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
            const completo = path.join(dir, entrada.name);
            if (entrada.isDirectory()) {
                // `src/app/api/**` es el servidor, no la interfaz: si el único
                // sitio que menciona la ruta fuera la ruta misma, seguiría sin
                // pantalla. Es justo lo que pasaba antes de esta spec.
                if (path.relative(RAIZ, completo) === path.join("src", "app", "api")) continue;
                recorrer(completo);
                continue;
            }
            if (!/\.tsx?$/.test(entrada.name)) continue;
            if (/\.(test|spec)\.tsx?$/.test(entrada.name)) continue;
            salida.push(completo);
        }
    };
    recorrer(path.join(RAIZ, "src", "app"));
    recorrer(path.join(RAIZ, "src", "components"));
    return salida;
}

function quienLlama(endpoint: RegExp): string[] {
    return archivosDeInterfaz()
        .filter((absoluto) => endpoint.test(fs.readFileSync(absoluto, "utf-8")))
        .map((absoluto) => path.relative(RAIZ, absoluto))
        .sort();
}

describe("SPEC-447 · la API de franjas no puede volver a quedarse sin pantalla", () => {
    it("alguna pantalla publica disponibilidad contra `POST /api/profesional/franjas`", () => {
        const consumidores = quienLlama(/["'`]\/api\/profesional\/franjas["'`]/);

        expect(
            consumidores,
            "La ruta existe desde SPEC-395 y estuvo SIN pantalla hasta SPEC-447: " +
                "`FranjaDisponible` tuvo 0 filas en toda la historia de producción, " +
                "y sin franjas ninguna familia puede agendar. Si esta lista queda " +
                "vacía, el profesional volvió a quedarse sin forma de publicarse.",
        ).not.toEqual([]);
    });

    it("y alguna pantalla puede retirarla — `DELETE /api/profesional/franjas/[id]`", () => {
        const consumidores = quienLlama(/\/api\/profesional\/franjas\/\$\{/);

        expect(
            consumidores,
            "Publicar sin poder retirar deja al profesional atado a una agenda que " +
                "no puede corregir. El DELETE también tiene que tener quien lo llame.",
        ).not.toEqual([]);
    });

    it("la pantalla vive en la ruta que fijó el CEO, no donde a cada quien le parezca", () => {
        // El contrato se fijó ANTES de construir (04-09 14:22) porque Calidad ya
        // tenía un candado apuntando a `/perfil-profesional/franjas`: si esta
        // pantalla nacía en otro lado, ese `test.fail` quedaba rojo para siempre
        // y su «unexpected pass» no llegaba nunca.
        const pagina = path.join(RAIZ, "src/app/dashboard/profesional/calendario/page.tsx");
        expect(fs.existsSync(pagina), "la pantalla debe vivir en /dashboard/profesional/calendario").toBe(true);
    });

    it("la hora no se calcula en la pantalla: sale del módulo de zona horaria", () => {
        const cliente = fs.readFileSync(
            path.join(RAIZ, "src/components/modules/profesional/CalendarioProfesional.tsx"),
            "utf-8",
        );

        expect(
            /instanteDesdeHoraBogota/.test(cliente),
            "La conversión de hora de pared a instante va por `@/lib/fechas/formato-bogota`.",
        ).toBe(true);

        const sinComentarios = cliente
            .split("\n")
            .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
            .join("\n");
        expect(
            /5\s*\*\s*60\s*\*\s*60\s*\*\s*1000|OFFSET_BOGOTA/.test(sinComentarios),
            "Un offset de Bogotá escrito a mano en la pantalla es el defecto de I-247: " +
                "se desincroniza en silencio. La zona horaria vive en un solo lugar.",
        ).toBe(false);
    });
});

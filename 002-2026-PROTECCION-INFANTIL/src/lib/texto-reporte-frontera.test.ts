/**
 * SPEC-130 (O-1) → S-C (D-116/D-117): guarda de frontera del texto del reporte.
 *
 * El relato vive cifrado en `ContenidoReporte` (DEK por fila). Una ruta de API (`route.ts`) que
 * necesite el texto DEBE obtenerlo por la capa autorizada fail-loud (`descifrarCampo`/
 * `descifrarCampos` de `reporte-texto-contenido`), NUNCA leyendo el ciphertext crudo
 * (`textoCifrado`/`textoOriginalCifrado`) para exponerlo al cliente: eso saltaría la capa de
 * descifrado y filtraría bytes cifrados o PII sin auditar.
 *
 * La ESCRITURA ya la cubren guardas MÁS fuertes, por eso este archivo ya no la re-verifica:
 *   - arch:check sección (g): `reporte.create`/`createMany` SOLO en el factory `crearReporteConTexto`.
 *   - el tipo: las columnas `Reporte.texto`/`Reporte.textoOriginal` fueron dropeadas (D-117); cualquier
 *     `texto:`/`textoOriginal:` en un `reporte.create/update` ni compila.
 *
 * Candado de conducta: reintroducir en una ruta una lectura del ciphertext crudo (un
 * `contenido.textoCifrado`, o un `select: { textoOriginalCifrado: true }`) lo pone en ROJO con
 * archivo:línea.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(__dirname, "../app/api");

// Acceso de PROPIEDAD (`.textoCifrado`) o CLAVE de objeto (`textoCifrado:`) al ciphertext crudo.
// Deliberadamente NO matchea prosa de comentarios: el identificador en un comentario no lleva ni
// un `.` inmediatamente delante ni un `:` inmediatamente detrás.
const LEE_CIFRADO_CRUDO = /\.(?:textoCifrado|textoOriginalCifrado)\b|\b(?:textoCifrado|textoOriginalCifrado)\s*:/;

function rutasApi(dir: string): string[] {
    const salida: string[] = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            salida.push(...rutasApi(full));
        } else if (entrada.name === "route.ts") {
            salida.push(full);
        }
    }
    return salida;
}

describe("frontera del texto del reporte (SPEC-130 O-1 · S-C D-116/D-117)", () => {
    it("ninguna ruta lee el ciphertext crudo del contenido — el texto sale solo por descifrarCampo(s)", () => {
        const violaciones: string[] = [];
        for (const archivo of rutasApi(API_DIR)) {
            const lineas = fs.readFileSync(archivo, "utf-8").split("\n");
            for (let i = 0; i < lineas.length; i++) {
                if (LEE_CIFRADO_CRUDO.test(lineas[i])) {
                    violaciones.push(`${path.relative(process.cwd(), archivo)}:${i + 1} ${lineas[i].trim()}`);
                }
            }
        }
        expect(
            violaciones,
            `Rutas que tocan el ciphertext crudo (el texto debe salir por descifrarCampo/descifrarCampos): ${violaciones.join("; ")}`
        ).toEqual([]);
    });
});

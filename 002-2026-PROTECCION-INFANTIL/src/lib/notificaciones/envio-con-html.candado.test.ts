/**
 * SPEC-909 · CANDADO (arch) — ningún `resend.emails.send` manda `text` sin `html`.
 *
 * El bug de prod salió por un emisor en texto plano. Hay DOS emisores directos de Resend
 * —el motor (`notificaciones/enviar-email.ts`) y `email/notificacion-spam.ts`— y el
 * comentario «único callsite legítimo» estaba STALE (barrido del CEO, SPEC-909). Este
 * candado barre TODO `src/**.ts(x)` (sin tests): cada `resend.emails.send({...})` que
 * mande `text:` DEBE incluir también `html`. Muere con el defecto: un emisor nuevo —o un
 * revert— en solo-texto lo pone rojo. Control positivo: encuentra ≥2 emisores (si el
 * barrido encontrara 0 por un cambio de ruta, el test no pasaría en vacío).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";

const SRC = path.resolve(__dirname, "../../../src");

function listarFuentes(dir: string): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...listarFuentes(p));
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
}

/** Texto de los argumentos de cada `.emails.send(` por balance de paréntesis. */
function bloquesEmailsSend(fuente: string): string[] {
    const bloques: string[] = [];
    const re = /\.emails\s*\.\s*send\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fuente)) !== null) {
        let depth = 1;
        const inicio = m.index + m[0].length;
        let i = inicio;
        for (; i < fuente.length && depth > 0; i++) {
            if (fuente[i] === "(") depth++;
            else if (fuente[i] === ")") depth--;
        }
        bloques.push(fuente.slice(inicio, i - 1));
    }
    return bloques;
}

describe("SPEC-909 · todo resend.emails.send manda html (no solo text)", () => {
    const emisores: { archivo: string; bloque: string }[] = [];
    for (const f of listarFuentes(SRC)) {
        const fuente = fs.readFileSync(f, "utf-8");
        if (!fuente.includes("emails")) continue;
        for (const bloque of bloquesEmailsSend(fuente)) {
            emisores.push({ archivo: path.relative(SRC, f), bloque });
        }
    }

    it("CONTROL: hay al menos 2 emisores directos de Resend", () => {
        expect(emisores.length).toBeGreaterThanOrEqual(2);
    });

    it("cada emisor que manda `text:` incluye también `html` (muere con un envío en solo-texto)", () => {
        const soloTexto = emisores.filter((e) => /\btext\s*:/.test(e.bloque) && !/\bhtml\b/.test(e.bloque));
        expect(soloTexto.map((e) => e.archivo)).toEqual([]);
    });
});

/**
 * SPEC-415 · candado: los ocho sitios que dejaron de tragarse el error no
 * pueden volver a enmudecer.
 *
 * Nace del barrido pedido por el CEO tras I-294: de 140 coincidencias en `src/`,
 * 34 valían mirar. Este PR arregla las 8 que hacen que **una persona tome una
 * decisión equivocada**; el resto quedó priorizado y sin tocar (C se junta con
 * I-236, D queda para después).
 *
 * El candado es estático a propósito: cuesta milisegundos, no necesita base, y
 * caza la recaída en el gate rápido. **Solo cubre estos ocho** — no es un
 * ratchet global, porque el resto del inventario todavía es una decisión abierta
 * del CEO y ponerlo en rojo acá sería adelantarme a esa decisión.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");

/**
 * Fuente sin comentarios. Hace falta porque estos archivos EXPLICAN el defecto
 * que arreglaron —"el `.catch(() => [])` que había acá"— y explicarlo no puede
 * poner el gate en rojo. Es la misma trampa que ya cazamos en SPEC-414.
 */
const leerCodigo = (r: string) =>
    leer(r)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

/** Grupo B · avisos de seguridad del cambio de clave. */
const AVISOS_DE_SEGURIDAD = [
    "src/app/api/admin/colegios/[id]/regenerar-password/route.ts",
    "src/app/api/admin/operadores/[id]/regenerar-password/route.ts",
    "src/app/api/auth/activar/route.ts",
    "src/app/api/auth/cambiar-password/route.ts",
    "src/app/api/auth/recuperar/restablecer/route.ts",
] as const;

describe("SPEC-415 · grupo B · el aviso de cambio de clave deja rastro", () => {
    it.each(AVISOS_DE_SEGURIDAD)("%s registra el fallo del aviso", (ruta) => {
        const fuente = leer(ruta);
        expect(fuente, "debe seguir enviando el aviso").toContain("enviarEmailCambioPassword(");
        // El fallo no bloquea (la clave YA cambió), pero deja rastro.
        expect(fuente).toContain('import { logger } from "@/lib/logger";');
        expect(fuente).toMatch(/logger\.error\(\s*\n?\s*"\[Seguridad\] No se pudo avisar el cambio de clave/);
    });

    it.each(AVISOS_DE_SEGURIDAD)("%s ya no tiene el catch mudo alrededor del aviso", (ruta) => {
        const fuente = leer(ruta);
        const mudo = /await enviarEmailCambioPassword\([^)]*\);\s*\}\s*catch\s*\{\s*\}/;
        expect(mudo.test(leerCodigo(ruta)), "volvió el `catch {}` mudo").toBe(false);
    });
});

describe("SPEC-415 · grupo A · «no hay nada» ≠ «no pude mirar»", () => {
    it("integrantes del comité: un fallo NO se renderiza como comité vacío", () => {
        const fuente = leer("src/app/dashboard/colegio/comite/integrantes/page.tsx");
        // El `.catch(() => [])` era la trampa: lista vacía indistinguible del fallo.
        expect(leerCodigo("src/app/dashboard/colegio/comite/integrantes/page.tsx"))
            .not.toMatch(/\.catch\(\s*\(\s*\)\s*=>\s*\[\]\s*\)/);
        expect(fuente).toContain("logger.error(");
        expect(fuente).toContain("integrantes === null");
        expect(fuente).toContain("No pudimos leer los integrantes del comité.");
        // Y el aviso dice exactamente lo que hay que no hacer: volver a cargarlos.
        expect(fuente).toContain("para no duplicar personas");
    });

    it("historial de informes del caso: un fallo NO se renderiza como historial vacío", () => {
        const fuente = leer("src/components/modules/colegio/casos/InformesCasoPanel.tsx");
        expect(fuente).toContain("errorHistorial");
        expect(fuente).toContain("No pudimos leer el historial.");
        expect(fuente).toMatch(/console\.error\("\[InformesCasoPanel\]/);
        // El comentario viejo decía que "el historial vacío ya comunica". Se
        // busca en el CÓDIGO: el archivo hoy cita esa frase para explicar por qué
        // estaba mal, y esa cita no puede poner el gate en rojo.
        expect(leerCodigo("src/components/modules/colegio/casos/InformesCasoPanel.tsx"))
            .not.toContain("el historial vacío ya comunica");
    });

    it("badge de notificaciones: `null` es «no pude preguntar», distinto de 0", () => {
        const fuente = leer("src/components/modules/NotificacionesInbox.tsx");
        expect(fuente).toContain("useState<number | null>(0)");
        expect(fuente).toContain("noLeidas === null");
        expect(fuente).toContain("no se pudo consultar si hay nuevas");
        expect(fuente).toMatch(/console\.error\("\[NotificacionesInbox\]/);
        // Marcar una como leída no puede inventar un número desde "no sé".
        expect(fuente).toContain("(n === null ? null : Math.max(0, n - 1))");
    });
});

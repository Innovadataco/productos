/**
 * SPEC-931 · CANDADO (puro, sin BD) — Usuarios → Estudiantes.
 *
 *   (1) La entrada EXISTE en el menú del colegio: «Estudiantes», PRIMERA de «Usuarios» (FORMA §3.1:
 *       Estudiantes · Profesores · Comité), módulo `colegios_gestion` (el de Profesores, sin módulo nuevo).
 *       Control positivo: sin el módulo, el menú del rector NO la muestra (la aserción reacciona).
 *   (2) El menú no miente y esconderlo no cierra la pantalla: la página existe y exige EN EL SERVIDOR el
 *       MISMO módulo que la entrada (`verificarAccesoPagina` + `SinAccesoModulo`).
 *   (3) DTO EXACTO: id, nombre, curso y conteos — aunque la fila traiga otra columna, no sale.
 *   (4) «← Volver» del detalle: el enlace del listado y el destino del detalle están de acuerdo.
 *   (5) COPY I-429: el motor compara solo el VALOR; el listado no afirma vigilar «en esta plataforma».
 *
 * La pertenencia (A no ve a B) y el 403/SinAcceso con BD real viven en `api/colegio/estudiantes/route.test.ts`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { COLEGIO_NAV_ITEMS } from "@/lib/nav-items";
import { navParaRol } from "@/lib/nav/para-rol";
import { aEstudianteListado, type FilaEstudianteColegio } from "./estudiantes-listado";
import { destinoVolverEstudiante } from "./volver-estudiante";
import { hrefDetalleEstudiante } from "@/app/dashboard/colegio/estudiantes/EstudiantesPageClient";

const HREF = "/dashboard/colegio/estudiantes";
const DIR_PAGINA = path.resolve(__dirname, "../../app/dashboard/colegio/estudiantes");

/** Frases que afirmarían una conducta que el motor NO tiene (coincidencia por plataforma, I-429). */
export function afirmaPlataforma(texto: string): string[] {
    const patrones = [/en esta plataforma/i, /esta cuenta en/i, /vigil\w* .{0,40}\ben (instagram|tiktok|facebook|whatsapp|discord)/i];
    return patrones.filter((p) => p.test(texto)).map(String);
}

describe("SPEC-931 · Usuarios → Estudiantes", () => {
    const usuarios = COLEGIO_NAV_ITEMS.find((e) => e.label === "Usuarios");

    it("(1) la entrada existe: primera de «Usuarios», módulo colegios_gestion, en el orden de la FORMA", () => {
        expect(usuarios?.children?.map((c) => c.label)).toEqual(["Estudiantes", "Profesores", "Comité de convivencia"]);
        expect(usuarios?.children?.[0]).toEqual({ href: HREF, label: "Estudiantes", modulo: "colegios_gestion" });
        const profesores = usuarios?.children?.find((c) => c.label === "Profesores");
        expect(usuarios?.children?.[0]?.modulo, "mismo módulo que Profesores (sin módulo nuevo)").toBe(profesores?.modulo);
    });

    it("(1) el menú del rector la muestra con el módulo (control positivo: sin el módulo, NO)", () => {
        const hojas = (mods: string[]) =>
            navParaRol("SCHOOL_ADMIN", { modulosPermitidos: mods }).flatMap((e) => [e.href, ...(e.children ?? []).map((c) => c.href)]);
        expect(hojas(["colegios_gestion"])).toContain(HREF);
        expect(hojas(["colegios_comite"])).not.toContain(HREF);
    });

    it("(2) la página existe y exige EN EL SERVIDOR el mismo módulo que la entrada", () => {
        const page = fs.readFileSync(path.join(DIR_PAGINA, "page.tsx"), "utf-8");
        expect(page).not.toMatch(/^\s*["']use client["']/m); // la guardia corre en el servidor
        expect(page).toMatch(/verificarAccesoPagina\(\s*["']colegios_gestion["']\s*\)/);
        expect(page).toMatch(/if\s*\(\s*!acceso\.permitido\s*\)\s*return\s*<SinAccesoModulo/);
    });

    it("(3) DTO exacto: una columna de más en la fila NO sale a la respuesta", () => {
        const fila = {
            id: "e1",
            nombre: "Ana",
            apellidos: "Ruiz",
            curso: { id: "c1", nombre: "Sexto", colegioId: "col-x" },
            _count: { identificadores: 2, acudientes: 1 },
            documentoNumero: "DOC-QUE-NO-DEBE-SALIR",
        } as FilaEstudianteColegio;
        const dto = aEstudianteListado(fila);
        expect(dto).toEqual({ id: "e1", nombre: "Ana Ruiz", curso: { id: "c1", nombre: "Sexto" }, identificadoresActivos: 2, acudientes: 1 });
        expect(JSON.stringify(dto)).not.toContain("DOC-QUE-NO-DEBE-SALIR");
        expect(aEstudianteListado({ ...fila, apellidos: "" }).nombre).toBe("Ana");
    });

    it("(4) el enlace del listado y el «← Volver» del detalle están de acuerdo", () => {
        const href = hrefDetalleEstudiante("e1");
        expect(href.startsWith("/dashboard/colegio/alumnos/e1")).toBe(true); // la ruta del detalle no se renombra
        const desde = new URL(href, "http://x").searchParams.get("desde") ?? undefined;
        const est = { cursoId: "c9" };
        expect(destinoVolverEstudiante(desde, est)).toEqual({ href: HREF, etiqueta: "← Volver a estudiantes" });
        // Desde el curso (o sin origen, u origen desconocido), como siempre: al curso.
        expect(destinoVolverEstudiante(undefined, est)).toEqual({ href: "/dashboard/colegio/cursos/c9", etiqueta: "← Volver al curso" });
        expect(destinoVolverEstudiante("otro", est).href).toBe("/dashboard/colegio/cursos/c9");
        // Aún sin cargar el estudiante: el mismo `/cursos/` que tenía el botón (no revienta).
        expect(destinoVolverEstudiante(undefined, null).href).toBe("/dashboard/colegio/cursos/");
    });

    it("(5) COPY I-429: el listado no afirma vigilar «en esta plataforma» (control positivo del detector)", () => {
        expect(afirmaPlataforma("Vigilamos esta cuenta en Instagram.")).not.toEqual([]);
        expect(afirmaPlataforma("Si alguien reporta uno de estos valores, el aviso llega al colegio.")).toEqual([]);
        for (const archivo of ["page.tsx", "EstudiantesPageClient.tsx"]) {
            expect(afirmaPlataforma(fs.readFileSync(path.join(DIR_PAGINA, archivo), "utf-8")), archivo).toEqual([]);
        }
    });
});

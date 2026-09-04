/**
 * SPEC-437 (A-75 · puntos 1 y 2) · el menú del profesional.
 *
 * Jelkin, textual: *«debe aparecer sus módulos, debemos utilizar la misma
 * lógica de operador»*. Y el candado que el radicado pone por encima de todo
 * lo demás, heredado de **I-299**: **ningún ítem que lleve a una pantalla que
 * no existe**, y ninguno ajeno a su rol.
 *
 * Ese candado **manda sobre la lista de seis** del radicado. El radicado pide
 * seis ítems y a la vez prohíbe pintar pantallas inexistentes; solo existían
 * tres. Se construyeron dos («Citaciones» y «Casos»), y «Calendario» entra
 * cuando SPEC-447 lo construya — su módulo ya está sembrado, que es otra cosa.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PROFESIONAL_NAV_ITEMS, ADMIN_NAV_ITEMS, PADRE_NAV_ITEMS, COLEGIO_NAV_ITEMS } from "@/lib/nav-items";
import { CATALOGO_MODULOS } from "@/lib/permisos-catalogo";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

const RAIZ = path.resolve(__dirname, "../../..");

/** ¿La ruta tiene un `page.tsx` de verdad? El menú no puede prometer lo que no hay. */
function existeLaPantalla(href: string): boolean {
    const relativo = href.replace(/^\//, "");
    return fs.existsSync(path.join(RAIZ, "src", "app", relativo, "page.tsx"));
}

describe("SPEC-437 · el menú del profesional no promete pantallas muertas (I-299)", () => {
    it.each(PROFESIONAL_NAV_ITEMS.map((i) => [i.label, i.href] as const))(
        "«%s» → %s tiene página construida",
        (_label, href) => {
            expect(
                existeLaPantalla(href),
                `El menú lleva a ${href} y ahí no hay page.tsx. Es I-299 otra vez: ` +
                    "si algo no está construido, no se pinta.",
            ).toBe(true);
        },
    );

    it("y la puerta DEJA entrar al profesional a cada uno — pintar lo que se le niega es el rebote de I-25", () => {
        for (const item of PROFESIONAL_NAV_ITEMS) {
            expect(
                esDestinoPermitidoPorRol("PROFESIONAL", item.href),
                `La puerta le niega ${item.href} al PROFESIONAL, pero el menú se lo pinta.`,
            ).toBe(true);
        }
    });
});

describe("SPEC-437 · cero ítems ajenos", () => {
    const ajenos = new Set<string>([
        ...ADMIN_NAV_ITEMS.map((i) => i.href),
        ...COLEGIO_NAV_ITEMS.map((i) => i.href),
        ...PADRE_NAV_ITEMS.map((i) => i.href),
    ]);

    it("ninguna ruta del admin, del colegio o del padre se cuela en su menú", () => {
        const colados = PROFESIONAL_NAV_ITEMS.filter((i) => ajenos.has(i.href)).map((i) => i.href);
        expect(colados).toEqual([]);
    });

    it("todas sus rutas son suyas: área del profesional o su ficha", () => {
        for (const item of PROFESIONAL_NAV_ITEMS) {
            expect(
                item.href.startsWith("/dashboard/profesional") || item.href.startsWith("/perfil-profesional"),
                `${item.href} no pertenece al área del profesional.`,
            ).toBe(true);
        }
    });
});

describe("SPEC-437 · misma mecánica que el operador: módulo por ítem", () => {
    const claves = new Set(CATALOGO_MODULOS.map((m) => m.clave));

    it("cada ítem cuelga de un módulo del catálogo, no de una condición quemada", () => {
        for (const item of PROFESIONAL_NAV_ITEMS) {
            expect(item.modulo, `«${item.label}» no declara módulo`).toBeTruthy();
            expect(claves.has(item.modulo), `módulo "${item.modulo}" no está en el catálogo`).toBe(true);
        }
    });

    it("los seis módulos del profesional existen aunque su pantalla todavía no", () => {
        const delProfesional = CATALOGO_MODULOS.filter((m) => m.categoria === "profesional").map((m) => m.clave);
        expect(delProfesional.sort()).toEqual([
            "profesional_calendario",
            "profesional_casos",
            "profesional_ficha",
            "profesional_inicio",
            "profesional_citaciones",
            "profesional_verificacion",
        ].sort());
    });

    it("el rol PROFESIONAL los tiene concedidos en el seed", () => {
        const seed = fs.readFileSync(path.join(RAIZ, "prisma/seed-modulos-grants.ts"), "utf-8");
        const bloque = seed.slice(seed.indexOf("PROFESIONAL: ["), seed.indexOf("]", seed.indexOf("PROFESIONAL: [")));
        for (const m of CATALOGO_MODULOS.filter((x) => x.categoria === "profesional")) {
            expect(bloque.includes(`"${m.clave}"`), `${m.clave} no se le concede a PROFESIONAL`).toBe(true);
        }
    });
});

describe("SPEC-437 · la barra lateral y el desplegable salen de la MISMA lista", () => {
    const leerCodigo = (rel: string) =>
        fs
            .readFileSync(path.join(RAIZ, rel), "utf-8")
            .split("\n")
            .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
            .join("\n");

    it("`AdminNav` pinta la barra del profesional con `PROFESIONAL_NAV_ITEMS`", () => {
        const nav = leerCodigo("src/components/modules/AdminNav.tsx");
        expect(/PROFESIONAL_NAV_ITEMS/.test(nav)).toBe(true);
        expect(
            /permitidos\.has\(l\.modulo\)/.test(nav),
            "El filtrado por módulo es la mecánica del operador que Jelkin pidió reusar.",
        ).toBe(true);
    });

    /**
     * Este candado nació con el assert MÁS ANGOSTO QUE SU PROPIO NOMBRE: decía
     * «NavHeader ya no lleva los enlaces quemados» pero solo miraba
     * `NavDropdownLink`. `NavHeader.tsx` tiene DOS menús —el desplegable de
     * escritorio y el móvil (`MobileLink`, `sm:hidden`, 200 líneas más abajo)—
     * y el móvil seguía quemado. Pasaba en verde con el defecto vivo: en
     * teléfono el profesional no tenía por dónde volver a su panel, porque el
     * botón «Dashboard» es `hidden sm:inline-flex`.
     *
     * Ahora el barrido es por ARCHIVO, no por componente: cualquier destino del
     * profesional quemado en cualquiera de los dos menús lo mata. Si mañana
     * aparece un tercer renderizador, también.
     */
    it("`NavHeader` no lleva NINGÚN destino del profesional quemado, en ninguno de sus menús", () => {
        const header = leerCodigo("src/components/modules/NavHeader.tsx");
        expect(
            /PROFESIONAL_NAV_ITEMS/.test(header),
            "Los menús del profesional salen de la constante, no de enlaces sueltos.",
        ).toBe(true);

        // Los dos renderizadores tienen que consumir la constante. Que uno la
        // use y el otro no es exactamente la divergencia que la spec cierra.
        for (const componente of ["NavDropdownLink", "MobileLink"]) {
            const usaLaConstante = new RegExp(
                `PROFESIONAL_NAV_ITEMS[\\s\\S]{0,400}?<${componente}\\b`,
            ).test(header);
            expect(
                usaLaConstante,
                `<${componente}> no pinta PROFESIONAL_NAV_ITEMS: ese menú puede decir algo distinto del otro.`,
            ).toBe(true);
        }

        // Y ningún href del profesional escrito a mano, sea cual sea el
        // componente que lo pinte.
        const quemados = header
            .split("\n")
            .filter((l) => /href="\/(perfil-profesional|dashboard\/profesional)\//.test(l));
        expect(
            quemados,
            `Destinos del profesional quemados en NavHeader (deben salir de PROFESIONAL_NAV_ITEMS):\n${quemados.join("\n")}`,
        ).toEqual([]);
    });

    it("el área del profesional tiene layout con barra lateral, y también su ficha", () => {
        for (const layout of [
            "src/app/dashboard/profesional/layout.tsx",
            "src/app/perfil-profesional/layout.tsx",
        ]) {
            expect(fs.existsSync(path.join(RAIZ, layout)), `falta ${layout}`).toBe(true);
            expect(/AdminNav/.test(leerCodigo(layout))).toBe(true);
        }
    });
});

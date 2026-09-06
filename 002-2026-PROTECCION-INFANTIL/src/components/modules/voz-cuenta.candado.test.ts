/**
 * SPEC-512 · CANDADO de voz «la cuenta» (mapa cerrado de Diseño, 05-09).
 *
 * Decisión de Jelkin: en la CARA DEL PADRE y PÚBLICA, «identificador»/«nick» →
 * «la cuenta». ADENTRO (admin/operador/comité/colegio) se CONSERVA «identificador».
 *
 * Este candado vigila la CONDUCTA de la copia barrida: por cada superficie del
 * mapa exige la frase NUEVA presente y la frase VETADA ausente en la fuente
 * renderizada. Muere con el defecto: revertir cualquiera de las 29 cadenas
 * reintroduce la frase vetada (rojo) y borrarla quita la nueva (rojo).
 *
 * Diseño extendió el mapa a 32 cadenas (aceptó como huecos suyos los 3 residuales
 * que Dev 2 cazó): PublicDashboard:116 «Cuentas visibles», [nick]:39 description
 * «La cuenta no puede estar vacía…» y MisHijos:299 intro «una de sus cuentas…».
 * Este candado los cubre.
 *
 * NO toca el VALOR interpolado `{x.identificador}` ni la UI interna: eso vive en
 * otras rutas y conserva «identificador».
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src

type Barrido = { archivo: string; presentes: string[]; ausentes: string[] };

// Cada fila = una superficie del mapa. `presentes` ancla la copia nueva (no se
// puede pasar borrándola); `ausentes` mata la regresión a la palabra vetada.
const BARRIDO: Barrido[] = [
    // ── PÚBLICO ──────────────────────────────────────────────────────────────
    {
        archivo: "app/page.tsx",
        presentes: ["Consulta cuentas de riesgo"],
        ausentes: ["Consulta identificadores de riesgo"],
    },
    {
        archivo: "app/reportar/page.tsx",
        presentes: ["cuentas asociadas a conductas de riesgo"],
        ausentes: ["identificadores asociados a conductas de riesgo"],
    },
    {
        archivo: "app/dashboard-publico/page.tsx",
        presentes: ["cuentas reportadas visibles públicamente"],
        ausentes: ["identificadores reportados visibles públicamente"],
    },
    {
        archivo: "components/modules/PublicDashboard.tsx",
        presentes: ['label="Cuentas visibles"'],
        ausentes: ['label="Identificadores visibles"'],
    },
    {
        archivo: "components/modules/LandingHero.tsx",
        presentes: ["Busca una cuenta", "Sin reportes registrados para esta cuenta."],
        ausentes: ["Busca un número, nick o usuario", "para este identificador."],
    },
    {
        archivo: "components/modules/LandingFeatures.tsx",
        presentes: ["Verifica si una cuenta fue reportada antes de interactuar."],
        ausentes: ["número, nick o usuario"],
    },
    {
        archivo: "components/modules/ConsultaForm.tsx",
        presentes: ["Ingresa la cuenta que quieres consultar.", "La cuenta (número o usuario)"],
        ausentes: ["Número, nick o usuario", "Ingresa el número, nick o usuario"],
    },
    {
        archivo: "components/modules/ConsultaEnriquecidaClient.tsx",
        presentes: [
            "Ingresa una cuenta válida (mínimo 3 caracteres).",
            "Error consultando la cuenta.",
            "La cuenta (número o usuario)",
            "Sin reportes registrados para esta cuenta.",
        ],
        ausentes: [
            "Ingresa un identificador válido",
            "Error consultando el identificador.",
            "Número, nick o usuario",
            "para este identificador.",
        ],
    },
    {
        archivo: "components/modules/ReporteStepPlataforma.tsx",
        presentes: ["¿Qué cuenta está asociada a la situación?", "La cuenta (número o usuario)"],
        ausentes: ["¿Qué identificador está asociado a la situación?", "Número, nick o usuario"],
    },
    {
        archivo: "components/modules/SeguimientoClient.tsx",
        presentes: [
            "Actividad de la cuenta",
            "Otros reportes de esta cuenta",
            "reportaron la misma cuenta.",
        ],
        ausentes: [
            "Actividad del identificador",
            "Otros reportes de este identificador",
            "reportaron el mismo identificador.",
        ],
    },
    // ── PADRE LOGUEADO ───────────────────────────────────────────────────────
    {
        archivo: "app/dashboard/padre/identificador/[nick]/page.tsx",
        presentes: ['title="Cuenta inválida"', "sobre esta cuenta.", "La cuenta no puede estar vacía"],
        ausentes: ['title="Identificador inválido"', "sobre este identificador.", "El identificador no puede estar vacío"],
    },
    {
        archivo: "components/modules/padre/IdentificadorBusquedaClient.tsx",
        presentes: [
            'placeholder="Buscar por cuenta (número, usuario o perfil)"',
            'aria-label="Buscar por cuenta"',
            "No tienes expedientes sobre esta cuenta",
        ],
        ausentes: ['placeholder="Buscar por identificador', 'aria-label="Buscar por identificador"', "sobre este identificador"],
    },
    {
        archivo: "components/modules/padre/MisHijos.tsx",
        presentes: [
            '"No se pudo cambiar la cuenta"',
            '"No se pudo agregar la cuenta"',
            ">Sus cuentas<",
            'label="Cuenta"',
            'title="La cuenta es del niño',
            'label="Agregar cuenta"',
            "una de sus",
            "cuentas (su Roblox, un teléfono, un correo)",
        ],
        ausentes: [
            '"No se pudo cambiar el identificador"',
            '"No se pudo agregar el identificador"',
            ">Sus identificadores<",
            'label="Identificador"',
            'title="El identificador es del niño',
            'label="Agregar identificador"',
            "identificadores (su Roblox, un teléfono, un correo)",
        ],
    },
];

describe("SPEC-512 · voz «la cuenta» en la cara del padre + pública", () => {
    for (const { archivo, presentes, ausentes } of BARRIDO) {
        it(`${archivo}: copia nueva presente, palabra vetada ausente`, () => {
            const ruta = path.join(SRC, archivo);
            const codigo = fs.readFileSync(ruta, "utf-8");
            for (const frase of presentes) {
                expect(codigo.includes(frase), `falta la copia nueva: «${frase}»`).toBe(true);
            }
            for (const frase of ausentes) {
                expect(codigo.includes(frase), `reapareció la palabra vetada: «${frase}»`).toBe(false);
            }
        });
    }

    it("adentro (admin/colegio) CONSERVA «identificador» — no se barrió de más", () => {
        // Contraprueba de alcance: la UI interna sigue con «identificador».
        const admin = fs.readFileSync(
            path.join(SRC, "components/modules/admin/IdentificadorExpedientesAnonimos.tsx"),
            "utf-8",
        );
        expect(admin.includes("identificador")).toBe(true);
    });
});

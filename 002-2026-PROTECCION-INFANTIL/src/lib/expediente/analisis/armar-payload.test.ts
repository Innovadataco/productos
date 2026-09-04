/**
 * SPEC-341 · T013 · guarda del blindaje del payload al modelo (SC-002, SC-006).
 *
 * Un modelo LLM ve exactamente lo que el orquestador arma. Estos tests le
 * ponen valla a lo que puede aparecer bajo cada `alcance` — SI CAMBIA el
 * armador y se cuela un identificador, texto o nombre por el `alcance` de
 * colegio, este test falla.
 */
import { describe, it, expect } from "vitest";
import { armarPayload, armarPayloadColegio, armarPayloadPadre } from "./armar-payload";
import { franjaBogota } from "@/lib/caso/hechos-caso";
import type { CategoriaConducta } from "@prisma/client";

describe("armarPayload · PADRE_COMPLETO", () => {
    // SPEC-431 (I-247 b) · el fixture está escrito en UTC pero PENSADO en hora
    // de Bogotá, que es la única que significa algo acá: «de noche» es un dato
    // del caso, no un detalle de formato. Las dos primeras son de NOCHE en
    // Riohacha —22:30 y 21:15— y por eso viven en la madrugada UTC del día
    // siguiente. Antes de SPEC-431 el armador las etiquetaba "0-6" (madrugada)
    // y este mismo fixture, escrito en UTC crudo, le daba la razón al defecto.
    const hechos = [
        {
            // 2026-08-01 22:30 Bogotá
            fecha: new Date("2026-08-02T03:30:00Z"),
            horaAproximada: false,
            ciudad: "Riohacha",
            pais: "CO",
            plataforma: "whatsapp",
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            edadReportada: 12,
        },
        {
            // 2026-08-15 21:15 Bogotá
            fecha: new Date("2026-08-16T02:15:00Z"),
            horaAproximada: false,
            ciudad: "Riohacha",
            pais: "CO",
            plataforma: "whatsapp",
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            edadReportada: 12,
        },
        {
            // 2026-08-20 09:00 Bogotá
            fecha: new Date("2026-08-20T14:00:00Z"),
            horaAproximada: false,
            ciudad: "Valledupar",
            pais: "CO",
            plataforma: "instagram",
            categoria: "SOLICITUD_MATERIAL" as CategoriaConducta,
            edadReportada: 13,
        },
    ];
    const hijoCruzado = { edad: 12, sexo: "F" };

    /** La franja de UN hecho: con uno solo, el dominante ES su franja. */
    const franjaDeUnHecho = (fecha: Date): string | null =>
        armarPayloadPadre({
            hechos: [
                {
                    fecha,
                    horaAproximada: false,
                    ciudad: "Riohacha",
                    pais: "CO",
                    plataforma: "whatsapp",
                    categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
                    edadReportada: 12,
                },
            ],
            hijoCruzado: null,
        }).franjaHorariaDominante;

    it("incluye la lista completa de hechos y el hijo cruzado", () => {
        const p = armarPayloadPadre({ hechos, hijoCruzado });
        expect(p.alcance).toBe("PADRE_COMPLETO");
        expect(p.numHechos).toBe(3);
        expect(p.hechos).toHaveLength(3);
        expect(p.hijoCruzado).toEqual({ edad: 12, sexo: "F" });
    });

    it("calcula categoría y ciudad dominantes", () => {
        const p = armarPayloadPadre({ hechos, hijoCruzado });
        expect(p.categoriaDominante).toBe("CONTACTO_INSISTENTE");
        expect(p.ciudadDominante).toBe("Riohacha");
    });

    it("SPEC-431 · la franja dominante es la NOCHE de Bogotá, no la madrugada UTC", () => {
        const p = armarPayloadPadre({ hechos, hijoCruzado });
        // Los dos hechos son de las 22:30 y las 21:15 en Bogotá. Con el defecto
        // de I-247 b —`getUTCHours()` sin restar el offset— esto daba "0-6" y le
        // contaba al modelo una historia de madrugada que nunca pasó.
        expect(p.franjaHorariaDominante).toBe("18-24");
        expect(p.franjaHorariaDominante, "el defecto devolvía madrugada").not.toBe("0-6");
    });

    it("SPEC-431 · cada hecho cae en su franja de Bogotá, uno por uno", () => {
        // Uno por uno, para que un empate de conteos no pueda tapar un error:
        // el dominante del conjunto podría acertar por casualidad.
        expect(hechos.map((h) => franjaDeUnHecho(h.fecha))).toEqual(["18-24", "18-24", "6-12"]);
    });

    it("SPEC-431 · los bordes del día caen donde deben", () => {
        // Los bordes son donde un offset mal aplicado se nota primero.
        const casos: Array<[string, string]> = [
            ["2026-08-02T05:00:00Z", "0-6"], //  00:00 Bogotá — recién empieza el día
            ["2026-08-02T10:59:00Z", "0-6"], //  05:59 Bogotá — último minuto de madrugada
            ["2026-08-02T11:00:00Z", "6-12"], // 06:00 Bogotá
            ["2026-08-02T23:00:00Z", "18-24"], // 18:00 Bogotá — arranca la noche
            ["2026-08-03T04:59:00Z", "18-24"], // 23:59 Bogotá — el filo del día
        ];
        for (const [iso, esperada] of casos) {
            expect(franjaDeUnHecho(new Date(iso)), `${iso} debía caer en ${esperada}`).toBe(esperada);
        }
    });

    it("SPEC-431 · coincide con la franja que ya calculaba bien el caso del colegio", () => {
        // `hechos-caso.ts` resuelve lo mismo con `Intl` y zona horaria real.
        // Dos implementaciones que discrepen son un defecto esperando su turno,
        // así que se comparan las 24 horas del día, no una muestra.
        for (let h = 0; h < 24; h++) {
            const fecha = new Date(Date.UTC(2026, 7, 2, h, 30));
            expect(franjaDeUnHecho(fecha), `discrepan en ${fecha.toISOString()}`).toBe(
                franjaBogota(fecha),
            );
        }
    });

    it("tolera lista vacía sin colgar", () => {
        const p = armarPayloadPadre({ hechos: [], hijoCruzado: null });
        expect(p.numHechos).toBe(0);
        expect(p.categoriaDominante).toBeNull();
        expect(p.ciudadDominante).toBeNull();
    });
});

describe("armarPayload · COLEGIO_BLINDADO (BLINDAJE PII · SC-002/SC-006)", () => {
    const agregados = [
        { curso: "9°-A", plataforma: "whatsapp", franjaHoraria: "18-24", categoria: "CONTACTO_INSISTENTE" as CategoriaConducta, cantidad: 3 },
        { curso: "9°-A", plataforma: "instagram", franjaHoraria: "12-18", categoria: "SUPLANTACION_IDENTIDAD" as CategoriaConducta, cantidad: 2 },
        { curso: "10°-B", plataforma: "tiktok", franjaHoraria: "18-24", categoria: "CIBERACOSO" as CategoriaConducta, cantidad: 4 },
    ];

    it("agrega correctamente por categoría, franja, curso y plataforma", () => {
        const p = armarPayloadColegio({ agregados });
        expect(p.alcance).toBe("COLEGIO_BLINDADO");
        expect(p.numHechos).toBe(9);
        expect(p.agregadosPorCurso.find((a) => a.curso === "9°-A")?.cantidad).toBe(5);
        expect(p.agregadosPorCategoria.find((a) => a.categoria === "CIBERACOSO")?.cantidad).toBe(4);
    });

    it("NO contiene ningún identificador, nombre, texto, email, edad ni sexo (SC-002 · audit #214 nº6)", () => {
        // Sembramos nombres/identificadores/emails en el CONTEXTO del test — el payload NO los recibe.
        const identificadoresProhibidos = [
            "alum_1_0001", "acu_1_2", "prof_1_003",
            "María Fernanda", "Juan Carlos", "12345678",
            "textocifradodelreporte", "@usuario_real",
            // Audit #214 · fix nº6: emails también deben estar prohibidos.
            "acudiente@ejemplo.com", "profe.demo@innovadataco.com",
        ];
        const p = armarPayloadColegio({ agregados });
        const asJson = JSON.stringify(p);

        for (const prohibido of identificadoresProhibidos) {
            expect(asJson, `el payload de COLEGIO_BLINDADO NO puede contener "${prohibido}"`)
                .not.toContain(prohibido);
        }

        // Audit #214 · fix nº6: assert ESTRUCTURAL — el shape del payload se
        // valida con Object.keys, no solo con substring negativo. Si el
        // armador cambia y agrega un campo nuevo, este test lo caza aunque
        // ningún string prohibido aparezca por casualidad.
        expect(Object.keys(p).sort()).toEqual(
            ["agregadosPorCategoria", "agregadosPorCurso", "agregadosPorFranja", "agregadosPorPlataforma", "alcance", "numHechos"].sort()
        );
        expect(p.alcance).toBe("COLEGIO_BLINDADO");
        // Ningún elemento de los agregados debe tener campos que no sean {categoria|franjaHoraria|curso|plataforma, cantidad}.
        for (const a of p.agregadosPorCategoria) expect(Object.keys(a).sort()).toEqual(["cantidad", "categoria"].sort());
        for (const a of p.agregadosPorFranja) expect(Object.keys(a).sort()).toEqual(["cantidad", "franjaHoraria"].sort());
        for (const a of p.agregadosPorCurso) expect(Object.keys(a).sort()).toEqual(["cantidad", "curso"].sort());
        for (const a of p.agregadosPorPlataforma) expect(Object.keys(a).sort()).toEqual(["cantidad", "plataforma"].sort());

        // Grep negativo también (respaldo al assert estructural).
        expect(asJson).toContain("COLEGIO_BLINDADO");
        expect(asJson).toContain("agregadosPorCategoria");
        expect(asJson).not.toContain("edadReportada");
        expect(asJson).not.toContain("hijoCruzado");
        expect(asJson).not.toContain("hechos");
        expect(asJson).not.toContain("email");
    });

    it("tolera lista vacía", () => {
        const p = armarPayloadColegio({ agregados: [] });
        expect(p.numHechos).toBe(0);
        expect(p.agregadosPorCategoria).toEqual([]);
    });
});

describe("armarPayload · entrada única con alcance", () => {
    it("despacha por alcance sin ramas escondidas", () => {
        const p1 = armarPayload({ alcance: "PADRE_COMPLETO", hechos: [], hijoCruzado: null });
        const p2 = armarPayload({ alcance: "COLEGIO_BLINDADO", agregados: [] });
        expect(p1.alcance).toBe("PADRE_COMPLETO");
        expect(p2.alcance).toBe("COLEGIO_BLINDADO");
    });
});

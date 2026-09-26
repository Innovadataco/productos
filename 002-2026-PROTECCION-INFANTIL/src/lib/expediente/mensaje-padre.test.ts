import { describe, it, expect } from "vitest";
import {
    construirMensajePadre,
    construirExplicacionPadre,
    construirAcompanamientoAnonimo,
    PLANTILLAS_DEFECTO,
    REENCUADRE_ANONIMO_DEFECTO,
    type CanalAyuda,
} from "./mensaje-padre";

const CANALES: CanalAyuda[] = [
    { nombre: "Línea 141 ICBF", contacto: "141", descripcion: "Línea gratuita del ICBF para reportar riesgos contra niños, niñas y adolescentes" },
    { nombre: "Te Protejo", contacto: "https://teprotejo.org", descripcion: "Canal para reportar material de abuso sexual infantil en internet" },
];

/** Atajo: el borrador del admin con las plantillas por defecto (variante padre). */
function msg(conductas: string[], canales: CanalAyuda[] = CANALES): string {
    return construirMensajePadre({ conductas, canales, plantillas: PLANTILLAS_DEFECTO });
}

describe("mensaje-padre (T023) — plantillas deterministas", () => {
    it("SIN score ni nivel de riesgo en el texto (constitución §1.3/§1.5)", () => {
        const m = msg(["SOLICITUD_MATERIAL", "EXTORSION"]);
        expect(m).not.toMatch(/score|nivel de riesgo|puntuaci[oó]n|puntos|gravedad/i);
    });

    it("marcado como borrador", () => {
        const m = msg(["SOLICITUD_MATERIAL"]);
        expect(m).toContain("BORRADOR");
        expect(m).toContain("No se envía automáticamente");
    });

    it("canales de ayuda vienen del parámetro (cambiar el parámetro cambia el mensaje)", () => {
        const m = msg(["SOLICITUD_MATERIAL"]);
        expect(m).toContain("Línea 141 ICBF (141)");
        expect(m).toContain("Te Protejo (https://teprotejo.org)");

        const canalesEditados: CanalAyuda[] = [
            { nombre: "CAI Virtual — Policía Nacional", contacto: "123", descripcion: "Emergencias y denuncias de la Policía Nacional" },
        ];
        const mEditado = msg(["SOLICITUD_MATERIAL"], canalesEditados);
        expect(mEditado).toContain("CAI Virtual — Policía Nacional (123)");
        expect(mEditado).not.toContain("Línea 141 ICBF");
    });

    it("el ensamblado varía según las conductas detectadas", () => {
        const material = msg(["SOLICITUD_MATERIAL"], []);
        expect(material).toContain("posibles solicitudes de fotos o videos íntimos");
        expect(material).not.toContain("encuentro en persona");

        const encuentro = msg(["SOLICITUD_ENCUENTRO"], []);
        expect(encuentro).toContain("posibles propuestas de encuentro en persona");
        expect(encuentro).not.toContain("fotos o videos íntimos");

        const combinado = msg(["SOLICITUD_MATERIAL", "SOLICITUD_ENCUENTRO"], []);
        expect(combinado).toContain("posibles solicitudes de fotos o videos íntimos");
        expect(combinado).toContain("posibles propuestas de encuentro en persona");
    });

    it("conducta desconocida cae en la plantilla genérica", () => {
        const m = msg(["CATEGORIA_INVENTADA"], []);
        expect(m).toContain("señales de una conducta que requiere atención");
    });

    it("sin conductas: mensaje tranquilo sin hallazgos", () => {
        const m = msg([]);
        expect(m).toContain("no encontramos conductas concretas");
        expect(m).toContain("Línea 141 ICBF");
    });
});

/**
 * Spec 116: la vista del padre reutiliza las MISMAS plantillas deterministas
 * (D-23) pero sin el marco de "borrador" y sin canales dentro del texto.
 * SPEC-736: la audiencia del padre se CONOCE → conserva «tu hijo».
 */
describe("construirExplicacionPadre (spec 116)", () => {
    it("describe las conductas con las mismas plantillas deterministas y sus recomendaciones", () => {
        const m = construirExplicacionPadre(["SOLICITUD_MATERIAL"], PLANTILLAS_DEFECTO);
        expect(m).toContain("posibles solicitudes de fotos o videos íntimos dirigidas a un menor");
        expect(m).toContain("No respondas a la solicitud ni envíes material íntimo");

        const combinado = construirExplicacionPadre(["SOLICITUD_MATERIAL", "CONTACTO_INSISTENTE"], PLANTILLAS_DEFECTO);
        expect(combinado).toContain("posibles solicitudes de fotos o videos íntimos");
        expect(combinado).toContain("posible contacto insistente que genera incomodidad");
        expect(combinado).toContain("Bloquea el contacto en la plataforma");
    });

    it("SPEC-736: el PADRE conserva «tu hijo» (audiencia conocida)", () => {
        const generica = construirExplicacionPadre(["CATEGORIA_INVENTADA"], PLANTILLAS_DEFECTO);
        expect(generica).toContain("tu hijo");
        const encuentro = construirExplicacionPadre(["SOLICITUD_ENCUENTRO"], PLANTILLAS_DEFECTO);
        expect(encuentro).toContain("tu hijo");
    });

    it("sin marco de borrador ni canales en el texto", () => {
        const m = construirExplicacionPadre(["SOLICITUD_MATERIAL"], PLANTILLAS_DEFECTO);
        expect(m).not.toContain("BORRADOR");
        expect(m).not.toContain("No se envía automáticamente");
        expect(m).not.toContain("canales oficiales");
    });

    it("sin score, nivel de riesgo, nombres de modelos, votos ni porcentajes", () => {
        const m = construirExplicacionPadre(["SOLICITUD_MATERIAL", "EXTORSION"], PLANTILLAS_DEFECTO);
        expect(m).not.toMatch(/score|nivel de riesgo|puntuaci[oó]n|gravedad|umbral|modelo|voto|%/i);
    });

    it("conducta sin plantilla específica cae en el texto institucional neutro", () => {
        const m = construirExplicacionPadre(["CATEGORIA_INVENTADA"], PLANTILLAS_DEFECTO);
        expect(m).toContain("señales de una conducta que requiere atención");
    });

    it("sin conductas confirmadas: texto institucional neutro", () => {
        const m = construirExplicacionPadre([], PLANTILLAS_DEFECTO);
        expect(m).toContain("no encontramos conductas concretas");
    });
});

/**
 * SPEC-736: el acompañamiento del reportante ANÓNIMO reencuadra las 4 conductas
 * personalizadas a genéricas (la persona afectada), conserva el hallazgo y NO
 * usa «tu hijo» (la audiencia no se conoce). Las «= igual» sirven a ambas.
 */
describe("construirAcompanamientoAnonimo (SPEC-736)", () => {
    const acomp = (conductas: string[]) =>
        construirAcompanamientoAnonimo(conductas, PLANTILLAS_DEFECTO, REENCUADRE_ANONIMO_DEFECTO);

    it("reencuadra las 4 personalizadas: NO dicen «tu hijo»", () => {
        for (const conducta of ["SOLICITUD_ENCUENTRO", "OFRECIMIENTO_REGALOS", "DOXING", "CATEGORIA_INVENTADA"]) {
            const { acciones } = acomp([conducta]);
            expect(acciones.join(" "), `${conducta} no debe decir «tu hijo» en el anónimo`).not.toContain("tu hijo");
        }
    });

    it("la conducta desconocida usa la recomendación genérica reencuadrada", () => {
        const { acciones } = acomp(["CATEGORIA_INVENTADA"]);
        expect(acciones[0]).toContain("la persona afectada");
    });

    it("las conductas «= igual» conservan su texto (sirven a ambas audiencias)", () => {
        const { acciones } = acomp(["EXTORSION"]);
        expect(acciones[0]).toContain("No cedas a las exigencias");
    });

    it("conserva el hallazgo hedgeado y deduplica por hallazgo", () => {
        const { hallazgos } = acomp(["SOLICITUD_ENCUENTRO"]);
        expect(hallazgos[0]).toContain("posibles propuestas de encuentro en persona");

        // OTRO y una desconocida caen ambas en la genérica → un solo hallazgo.
        const { hallazgos: dedup } = acomp(["OTRO", "CATEGORIA_INVENTADA"]);
        expect(dedup).toHaveLength(1);
    });

    it("sin conductas: sin hallazgos ni acciones (la pantalla muestra solo calma + canales)", () => {
        const { hallazgos, acciones } = acomp([]);
        expect(hallazgos).toHaveLength(0);
        expect(acciones).toHaveLength(0);
    });

    it("guardrails: no promete conducta del sistema ni score", () => {
        const { acciones } = acomp(["EXTORSION", "SOLICITUD_ENCUENTRO", "DOXING"]);
        const texto = acciones.join(" ");
        expect(texto).not.toMatch(/investigaremos|recibir[aá]s respuesta|el equipo revisar[aá]|score|nivel de riesgo/i);
    });
});

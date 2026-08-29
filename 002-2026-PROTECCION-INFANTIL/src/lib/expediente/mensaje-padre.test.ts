import { describe, it, expect } from "vitest";
import { construirMensajePadre, construirExplicacionPadre, type CanalAyuda } from "./mensaje-padre";

const CANALES: CanalAyuda[] = [
    { nombre: "Línea 141 ICBF", contacto: "141", descripcion: "Línea gratuita del ICBF para reportar riesgos contra niños, niñas y adolescentes" },
    { nombre: "Te Protejo", contacto: "https://teprotejo.org", descripcion: "Canal para reportar material de abuso sexual infantil en internet" },
];

describe("mensaje-padre (T023) — plantillas deterministas", () => {
    it("SIN score ni nivel de riesgo en el texto (constitución §1.3/§1.5)", () => {
        const msg = construirMensajePadre({ conductas: ["SOLICITUD_MATERIAL", "EXTORSION"], canales: CANALES });
        // La descripción de los canales (texto legal del parámetro) puede decir
        // "riesgos"; lo prohibido es el score/nivel del identificador.
        expect(msg).not.toMatch(/score|nivel de riesgo|puntuaci[oó]n|puntos|gravedad/i);
    });

    it("marcado como borrador", () => {
        const msg = construirMensajePadre({ conductas: ["SOLICITUD_MATERIAL"], canales: CANALES });
        expect(msg).toContain("BORRADOR");
        expect(msg).toContain("No se envía automáticamente");
    });

    it("canales de ayuda vienen del parámetro (cambiar el parámetro cambia el mensaje)", () => {
        const msg = construirMensajePadre({ conductas: ["SOLICITUD_MATERIAL"], canales: CANALES });
        expect(msg).toContain("Línea 141 ICBF (141)");
        expect(msg).toContain("Te Protejo (https://teprotejo.org)");

        const canalesEditados: CanalAyuda[] = [
            { nombre: "CAI Virtual — Policía Nacional", contacto: "123", descripcion: "Emergencias y denuncias de la Policía Nacional" },
        ];
        const msgEditado = construirMensajePadre({ conductas: ["SOLICITUD_MATERIAL"], canales: canalesEditados });
        expect(msgEditado).toContain("CAI Virtual — Policía Nacional (123)");
        expect(msgEditado).not.toContain("Línea 141 ICBF");
    });

    it("el ensamblado varía según las conductas detectadas", () => {
        const material = construirMensajePadre({ conductas: ["SOLICITUD_MATERIAL"], canales: [] });
        expect(material).toContain("posibles solicitudes de fotos o videos íntimos");
        expect(material).not.toContain("encuentro en persona");

        const encuentro = construirMensajePadre({ conductas: ["SOLICITUD_ENCUENTRO"], canales: [] });
        expect(encuentro).toContain("posibles propuestas de encuentro en persona");
        expect(encuentro).not.toContain("fotos o videos íntimos");

        const combinado = construirMensajePadre({ conductas: ["SOLICITUD_MATERIAL", "SOLICITUD_ENCUENTRO"], canales: [] });
        expect(combinado).toContain("posibles solicitudes de fotos o videos íntimos");
        expect(combinado).toContain("posibles propuestas de encuentro en persona");
    });

    it("conducta desconocida cae en la plantilla genérica", () => {
        const msg = construirMensajePadre({ conductas: ["CATEGORIA_INVENTADA"], canales: [] });
        expect(msg).toContain("señales de una conducta que requiere atención");
    });

    it("sin conductas: mensaje tranquilo sin hallazgos", () => {
        const msg = construirMensajePadre({ conductas: [], canales: CANALES });
        expect(msg).toContain("no encontramos conductas concretas");
        expect(msg).toContain("Línea 141 ICBF");
    });
});

/**
 * Spec 116: la vista del padre reutiliza las MISMAS plantillas deterministas
 * (D-23) pero sin el marco de "borrador" (eso es del expediente admin) y sin
 * canales dentro del texto (en la vista los muestra <CanalesOficiales />).
 */
describe("construirExplicacionPadre (spec 116)", () => {
    it("describe las conductas con las mismas plantillas deterministas y sus recomendaciones", () => {
        const msg = construirExplicacionPadre(["SOLICITUD_MATERIAL"]);
        expect(msg).toContain("posibles solicitudes de fotos o videos íntimos dirigidas a un menor");
        expect(msg).toContain("No respondas a la solicitud ni envíes material íntimo");

        const combinado = construirExplicacionPadre(["SOLICITUD_MATERIAL", "CONTACTO_INSISTENTE"]);
        expect(combinado).toContain("posibles solicitudes de fotos o videos íntimos");
        expect(combinado).toContain("posible contacto insistente que genera incomodidad");
        expect(combinado).toContain("Bloquea el contacto en la plataforma");
    });

    it("sin marco de borrador ni canales en el texto", () => {
        const msg = construirExplicacionPadre(["SOLICITUD_MATERIAL"]);
        expect(msg).not.toContain("BORRADOR");
        expect(msg).not.toContain("No se envía automáticamente");
        expect(msg).not.toContain("canales oficiales");
    });

    it("sin score, nivel de riesgo, nombres de modelos, votos ni porcentajes", () => {
        const msg = construirExplicacionPadre(["SOLICITUD_MATERIAL", "EXTORSION"]);
        expect(msg).not.toMatch(/score|nivel de riesgo|puntuaci[oó]n|gravedad|umbral|modelo|voto|%/i);
    });

    it("conducta sin plantilla específica cae en el texto institucional neutro", () => {
        const msg = construirExplicacionPadre(["CATEGORIA_INVENTADA"]);
        expect(msg).toContain("señales de una conducta que requiere atención");
    });

    it("sin conductas confirmadas: texto institucional neutro", () => {
        const msg = construirExplicacionPadre([]);
        expect(msg).toContain("no encontramos conductas concretas");
    });
});

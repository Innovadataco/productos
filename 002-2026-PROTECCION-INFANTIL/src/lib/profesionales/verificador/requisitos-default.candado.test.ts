/**
 * SPEC-700 (I-425) · CANDADO — el texto de los requisitos por defecto no nombra a una
 * persona del equipo ni dice «pendiente de definir».
 *
 * Verifica el REPO (la lista canónica que siembra el seed), no un artefacto. El control
 * POSITIVO exige que el detector CACE el texto retirado hoy («… pendiente de definir por
 * Jelkin …»): sin él, la aserción de «no hay prohibido» sería un falso verde si el
 * detector no detectara nada. El control NEGATIVO exige que un texto legítimo NO dispare.
 */
import { describe, it, expect } from "vitest";
import {
    REQUISITOS_VERIFICACION_DEFAULT,
    CLAVES_REQUISITOS_VIGENTES,
    detectarTextoProhibido,
} from "./requisitos-default";

describe("SPEC-700 · requisitos por defecto — sin nombre de persona ni «pendiente de definir»", () => {
    it("ningún texto (nombre/descripción) de un requisito trae fragmento prohibido", () => {
        const hallazgos = REQUISITOS_VERIFICACION_DEFAULT.flatMap((r) => [
            ...detectarTextoProhibido(r.nombre).map((p) => `${r.clave}.nombre: «${p}»`),
            ...detectarTextoProhibido(r.descripcion ?? "").map((p) => `${r.clave}.descripcion: «${p}»`),
        ]);
        expect(hallazgos).toEqual([]);
    });

    it("la lista por defecto es EXACTAMENTE las 3 claves vigentes (sin «otro»)", () => {
        expect(REQUISITOS_VERIFICACION_DEFAULT.map((r) => r.clave)).toEqual([...CLAVES_REQUISITOS_VIGENTES]);
        expect(REQUISITOS_VERIFICACION_DEFAULT.some((r) => r.clave === "otro")).toBe(false);
    });

    describe("control positivo/negativo del detector", () => {
        // El texto EXACTO que traía el «otro» retirado hoy.
        const TEXTO_OTRO_HOY =
            "Cuarto espacio libre — pendiente de definir por Jelkin. El Verificador lo trata como los demás.";

        it("POSITIVO · «pendiente de definir por Jelkin» dispara la frase Y el nombre", () => {
            const hallazgos = detectarTextoProhibido(TEXTO_OTRO_HOY);
            expect(hallazgos).toContain("pendiente de definir");
            expect(hallazgos).toContain("Jelkin");
        });

        it("POSITIVO · el nombre matchea sin importar mayúsculas", () => {
            expect(detectarTextoProhibido("Firmado por JELKIN.")).toContain("Jelkin");
        });

        it("NEGATIVO · un texto legítimo de requisito NO dispara (no muerde palabras comunes)", () => {
            expect(
                detectarTextoProhibido(
                    "Certificado de antecedentes (Ley 1918/2018 · 2375/2024, §5). El resultado es reservado por ley.",
                ),
            ).toEqual([]);
            expect(detectarTextoProhibido("Documento de identidad vigente.")).toEqual([]);
        });
    });
});

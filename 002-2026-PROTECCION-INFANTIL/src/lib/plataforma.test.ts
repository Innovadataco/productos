import { describe, it, expect } from "vitest";
import { formatPlataforma, formatPlataformasResumen } from "./plataforma";

describe("formatPlataforma", () => {
    it("devuelve el nombre cuando no es 'otro'", () => {
        expect(formatPlataforma("Discord", null, "discord")).toBe("Discord");
        expect(formatPlataforma("WhatsApp", undefined, "whatsapp")).toBe("WhatsApp");
    });

    it("devuelve otraPlataforma cuando la clave es 'otro' y tiene valor", () => {
        expect(formatPlataforma("Otra plataforma", "Signal", "otro")).toBe("Signal");
    });

    it("devuelve el nombre cuando clave es 'otro' pero otraPlataforma está vacía", () => {
        expect(formatPlataforma("Otra plataforma", null, "otro")).toBe("Otra plataforma");
        expect(formatPlataforma("Otra plataforma", "", "otro")).toBe("Otra plataforma");
        expect(formatPlataforma("Otra plataforma", "   ", "otro")).toBe("Otra plataforma");
    });

    it("nunca devuelve undefined", () => {
        expect(formatPlataforma("Discord", undefined, "discord")).not.toContain("undefined");
        expect(formatPlataforma("Otra plataforma", undefined, "otro")).not.toContain("undefined");
    });
});

describe("formatPlataformasResumen", () => {
    it("resume una sola plataforma", () => {
        expect(formatPlataformasResumen([{ nombre: "Discord", total: 1 }], 1)).toBe("1 reporte en Discord");
    });

    it("resume varias plataformas", () => {
        expect(
            formatPlataformasResumen(
                [
                    { nombre: "Roblox", total: 3 },
                    { nombre: "Snapchat", total: 1 },
                    { nombre: "Discord", total: 1 },
                ],
                5
            )
        ).toBe("5 reportes en Roblox, Snapchat y Discord");
    });

    it("usa el total derivado si no se pasa totalReportes", () => {
        expect(formatPlataformasResumen([{ nombre: "TikTok", total: 2 }])).toBe("2 reportes en TikTok");
    });
});

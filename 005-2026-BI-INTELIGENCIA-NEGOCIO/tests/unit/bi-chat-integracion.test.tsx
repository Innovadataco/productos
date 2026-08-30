import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NAV_ITEM_CHAT, EnlaceChatNav, BotonPreguntaAlgo } from "@/components/bi/chat/integracion";

describe("SPEC-026 · integración chat", () => {
    it("NAV_ITEM_CHAT expone href /chat + label + icon", () => {
        expect(NAV_ITEM_CHAT.href).toBe("/chat");
        expect(NAV_ITEM_CHAT.label).toBe("Chat NL→SQL");
        expect(NAV_ITEM_CHAT.icon).toBe("💬");
    });

    it("EnlaceChatNav renderiza <a href=/chat>", () => {
        render(<EnlaceChatNav />);
        const link = screen.getByTestId("enlace-chat-nav") as HTMLAnchorElement;
        expect(link.tagName).toBe("A");
        expect(link.getAttribute("href")).toBe("/chat");
        expect(link.textContent).toContain("Chat NL→SQL");
    });

    it("BotonPreguntaAlgo renderiza <a href=/chat> con label CTA", () => {
        render(<BotonPreguntaAlgo />);
        const link = screen.getByTestId("boton-pregunta-algo") as HTMLAnchorElement;
        expect(link.tagName).toBe("A");
        expect(link.getAttribute("href")).toBe("/chat");
        expect(link.textContent).toContain("Preguntá algo");
    });

    it("EnlaceChatNav acepta className adicional", () => {
        render(<EnlaceChatNav className="extra-class" />);
        const link = screen.getByTestId("enlace-chat-nav");
        expect(link.className).toContain("extra-class");
    });
});

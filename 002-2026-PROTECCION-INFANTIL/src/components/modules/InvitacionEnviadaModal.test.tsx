import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvitacionEnviadaModal } from "./InvitacionEnviadaModal";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

describe("InvitacionEnviadaModal", () => {
    it("muestra el mensaje de éxito y navega al listado", async () => {
        render(<InvitacionEnviadaModal isOpen onClose={vi.fn()} />);

        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(
            screen.getByText("✓ Invitación enviada · el rector recibió email para activar su cuenta")
        ).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Volver al listado" }));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/admin/colegios"));
    });
});

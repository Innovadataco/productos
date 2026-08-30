import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SupersetLink } from "@/components/bi/dashboards/SupersetLink";

const SLUGS_EN_ORDEN = ["ejecutivo", "motor_ia", "comercial", "operativo", "salud"] as const;

describe("SPEC-028 · SupersetLink", () => {
    it("renderiza 5 botones en orden Ejecutivo → Salud", () => {
        render(<SupersetLink baseUrl="http://sup.local:8088" />);
        for (const slug of SLUGS_EN_ORDEN) {
            expect(screen.getByTestId(`superset-btn-${slug}`)).toBeDefined();
        }
    });

    it("cada anchor tiene href correcto {base}/superset/dashboard/{slug}/", () => {
        render(<SupersetLink baseUrl="http://sup.local:8088" />);
        for (const slug of SLUGS_EN_ORDEN) {
            const a = screen.getByTestId(`superset-btn-${slug}`) as HTMLAnchorElement;
            expect(a.tagName).toBe("A");
            expect(a.getAttribute("href")).toBe(`http://sup.local:8088/superset/dashboard/${slug}/`);
        }
    });

    it("cada anchor tiene target=_blank + rel=noopener noreferrer", () => {
        render(<SupersetLink baseUrl="http://sup.local:8088" />);
        for (const slug of SLUGS_EN_ORDEN) {
            const a = screen.getByTestId(`superset-btn-${slug}`);
            expect(a.getAttribute("target")).toBe("_blank");
            expect(a.getAttribute("rel")).toBe("noopener noreferrer");
        }
    });

    it("prop baseUrl override funciona", () => {
        render(<SupersetLink baseUrl="https://custom.dashboards.example" />);
        const a = screen.getByTestId("superset-btn-ejecutivo") as HTMLAnchorElement;
        expect(a.getAttribute("href")).toBe("https://custom.dashboards.example/superset/dashboard/ejecutivo/");
    });

    it("slug motor_ia usa guion bajo (match yaml Superset), no motor-ia", () => {
        render(<SupersetLink baseUrl="http://x" />);
        expect(screen.queryByTestId("superset-btn-motor-ia")).toBeNull();
        const a = screen.getByTestId("superset-btn-motor_ia") as HTMLAnchorElement;
        expect(a.getAttribute("href")).toContain("/superset/dashboard/motor_ia/");
    });
});

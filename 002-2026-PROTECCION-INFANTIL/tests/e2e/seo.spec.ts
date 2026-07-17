import { test, expect } from "@playwright/test";

test.describe("SEO y metadatos", () => {
    test("la página de inicio tiene título, descripción y canonical", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Protección Infantil/);

        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveAttribute("content", /identificadores de riesgo/);

        const canonical = page.locator('link[rel="canonical"]');
        await expect(canonical).toHaveAttribute("href", /.+/);

        const ogTitle = page.locator('meta[property="og:title"]');
        await expect(ogTitle).toHaveAttribute("content", /Protección Infantil/);
    });

    test("la página de reportar tiene metadatos propios", async ({ page }) => {
        await page.goto("/reportar");
        await expect(page).toHaveTitle(/Reportar/);

        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveAttribute("content", /reporta/i);
    });

    test("las páginas legales tienen metadatos", async ({ page }) => {
        await page.goto("/terminos");
        await expect(page).toHaveTitle(/Términos de uso/);

        await page.goto("/privacidad");
        await expect(page).toHaveTitle(/Política de privacidad/);
    });

    test("robots.txt bloquea rutas privadas", async ({ page }) => {
        const response = await page.goto("/robots.txt");
        expect(response?.status()).toBe(200);

        const body = await page.locator("pre").innerText();
        expect(body).toContain("Disallow: /dashboard");
        expect(body).toContain("Disallow: /api");
        expect(body).toContain("Sitemap:");
    });

    test("sitemap.xml lista URLs públicas", async ({ request }) => {
        const response = await request.get("/sitemap.xml");
        expect(response.status()).toBe(200);

        const body = await response.text();
        expect(body).toContain("<urlset");
        expect(body).toContain("/reportar");
        expect(body).toContain("/dashboard-publico");
    });
});

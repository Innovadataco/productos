// Desarrollo local con la cookie Secure (D-014, decisión del coordinador): sin bypass. Chrome trata
// http://127.0.0.1 y localhost como contexto seguro (`npm run dev`); para Safari, `npm run dev:https`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../../../package.json", import.meta.url)), "utf8")) as {
  scripts: Record<string, string>;
};

describe("scripts de desarrollo", () => {
  it("`dev` no cambia: http en 127.0.0.1:5008", () => {
    expect(pkg.scripts.dev).toBe("next dev -H 127.0.0.1 -p 5008");
  });

  it("`dev:https` es la misma app con https local, en 127.0.0.1:5008", () => {
    expect(pkg.scripts["dev:https"]).toBe("next dev --experimental-https -H 127.0.0.1 -p 5008");
  });
});

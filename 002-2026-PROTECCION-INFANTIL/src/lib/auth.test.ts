import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("auth utils", () => {
    it("hashes and verifies password", async () => {
        const hash = await hashPassword("password123");
        expect(await verifyPassword("password123", hash)).toBe(true);
        expect(await verifyPassword("wrong", hash)).toBe(false);
    });
});
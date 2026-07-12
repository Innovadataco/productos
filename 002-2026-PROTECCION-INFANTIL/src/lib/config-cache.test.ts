import { describe, it, expect } from "vitest";
import { getCached, setCached, invalidateCache } from "./config-cache";

describe("config-cache", () => {
    it("stores and retrieves value", () => {
        setCached("key1", "value1");
        expect(getCached("key1")).toBe("value1");
    });

    it("returns undefined for missing key", () => {
        expect(getCached("missing")).toBeUndefined();
    });

    it("invalidates single key", () => {
        setCached("a", 1);
        setCached("b", 2);
        invalidateCache("a");
        expect(getCached("a")).toBeUndefined();
        expect(getCached("b")).toBe(2);
    });

    it("invalidates all", () => {
        setCached("a", 1);
        invalidateCache();
        expect(getCached("a")).toBeUndefined();
    });
});
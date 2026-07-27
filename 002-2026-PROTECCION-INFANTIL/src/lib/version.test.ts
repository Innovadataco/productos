import { describe, it, expect, afterEach } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION, getBuildSha } from "./version";

describe("version (spec 102)", () => {
    afterEach(() => {
        delete process.env.APP_BUILD_SHA;
    });

    it("APP_VERSION coincide con la version de package.json", () => {
        expect(APP_VERSION).toBe(pkg.version);
        expect(APP_VERSION).toBe("1.0.0");
    });

    it("getBuildSha devuelve null sin APP_BUILD_SHA", () => {
        delete process.env.APP_BUILD_SHA;
        expect(getBuildSha()).toBeNull();
    });

    it("getBuildSha devuelve null con APP_BUILD_SHA vacía", () => {
        process.env.APP_BUILD_SHA = "";
        expect(getBuildSha()).toBeNull();
    });

    it("getBuildSha lee APP_BUILD_SHA del entorno", () => {
        process.env.APP_BUILD_SHA = "abc1234";
        expect(getBuildSha()).toBe("abc1234");
    });
});

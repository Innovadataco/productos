import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ValidationError, parseBody, parseParams, withValidation } from "./validation";
import { ERROR_CODES } from "./errors";

describe("validation helpers", () => {
    const bodySchema = z.object({
        name: z.string().min(1),
        age: z.number().int().min(0),
    });

    const paramsSchema = z.object({ id: z.string().cuid() });

    describe("ValidationError", () => {
        it("constructs with VALIDATION_ERROR code and 400 status", () => {
            const err = new ValidationError("Datos inválidos", []);
            expect(err.code).toBe(ERROR_CODES.VALIDATION_ERROR);
            expect(err.statusCode).toBe(400);
            expect(err.message).toBe("Datos inválidos");
        });

        it("serializes to JSON with details", () => {
            const err = new ValidationError("Datos inválidos", [{ message: "Required", path: "name" }]);
            expect(err.toJSON()).toEqual({
                error: {
                    message: "Datos inválidos",
                    code: ERROR_CODES.VALIDATION_ERROR,
                    details: [{ message: "Required", path: "name" }],
                },
            });
        });
    });

    describe("parseBody", () => {
        it("parses and returns valid body", async () => {
            const request = new Request("http://localhost/api/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Ana", age: 30 }),
            });
            const data = await parseBody(request, bodySchema);
            expect(data).toEqual({ name: "Ana", age: 30 });
        });

        it("throws ValidationError for invalid body", async () => {
            const request = new Request("http://localhost/api/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "", age: -1 }),
            });
            await expect(parseBody(request, bodySchema)).rejects.toBeInstanceOf(ValidationError);
        });

        it("throws ValidationError when body is not JSON", async () => {
            const request = new Request("http://localhost/api/test", {
                method: "POST",
                body: "not-json",
            });
            await expect(parseBody(request, bodySchema)).rejects.toBeInstanceOf(ValidationError);
        });
    });

    describe("parseParams", () => {
        it("parses and returns valid params", () => {
            const params = { id: "cm0k5example12345678901234567890" };
            const data = parseParams(params, paramsSchema);
            expect(data).toEqual(params);
        });

        it("throws ValidationError for invalid params", () => {
            const params = { id: "not-a-cuid" };
            expect(() => parseParams(params, paramsSchema)).toThrow(ValidationError);
        });
    });

    describe("withValidation", () => {
        it("body() returns a parser function", async () => {
            const request = new Request("http://localhost/api/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Luis", age: 25 }),
            });
            const data = await withValidation.body(bodySchema)(request);
            expect(data).toEqual({ name: "Luis", age: 25 });
        });

        it("body() throws ValidationError for invalid body", async () => {
            const request = new Request("http://localhost/api/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Luis" }),
            });
            await expect(withValidation.body(bodySchema)(request)).rejects.toBeInstanceOf(ValidationError);
        });

        it("params() returns a parser function", () => {
            const params = { id: "cm0k5example12345678901234567890" };
            const data = withValidation.params(paramsSchema)(params);
            expect(data).toEqual(params);
        });

        it("params() throws ValidationError for invalid params", () => {
            const params = { id: "not-a-cuid" };
            expect(() => withValidation.params(paramsSchema)(params)).toThrow(ValidationError);
        });
    });
});

import { describe, it, expect } from "vitest";
import { AppError, ERROR_CODES } from "./errors";

describe("AppError", () => {
    it("constructs with defaults", () => {
        const err = new AppError("test error");
        expect(err.message).toBe("test error");
        expect(err.code).toBe(ERROR_CODES.INTERNAL_ERROR);
        expect(err.statusCode).toBe(500);
    });

    it("constructs with custom code and status", () => {
        const err = new AppError("not found", ERROR_CODES.NOT_FOUND, 404);
        expect(err.code).toBe("NOT_FOUND");
        expect(err.statusCode).toBe(404);
    });

    it("serializes to JSON", () => {
        const err = new AppError("fail", ERROR_CODES.VALIDATION_ERROR, 400);
        expect(err.toJSON()).toEqual({
            error: { message: "fail", code: "VALIDATION_ERROR" },
        });
    });
});
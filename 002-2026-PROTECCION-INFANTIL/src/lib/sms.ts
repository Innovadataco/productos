import { createHash, randomInt } from "crypto";
import { logger } from "@/lib/logger";

export interface SmsProvider {
    sendSms(to: string, message: string): Promise<void>;
}

class MockSmsProvider implements SmsProvider {
    async sendSms(to: string, message: string): Promise<void> {
                logger.info(`[SMS MOCK] to=${to} message="${message}"`);
    }
}

export function getSmsProvider(): SmsProvider {
    const provider = process.env.SMS_PROVIDER || "mock";
    if (provider === "mock") return new MockSmsProvider();
    throw new Error(`SMS provider no implementado: ${provider}`);
}

export function generarCodigoOtp(): string {
    return String(randomInt(100000, 999999));
}

export function hashCodigo(codigo: string): string {
    return createHash("sha256").update(codigo).digest("hex");
}

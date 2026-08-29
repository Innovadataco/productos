import bcrypt from "bcryptjs";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "";

export async function hashDemoPassword(): Promise<string> {
    if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
        throw new Error("[demo] DEMO_PASSWORD no definida o débil (mínimo 8 caracteres)");
    }
    return bcrypt.hash(DEMO_PASSWORD, 12);
}

export function getDemoPassword(): string {
    if (!DEMO_PASSWORD) throw new Error("[demo] DEMO_PASSWORD no definida");
    return DEMO_PASSWORD;
}

import { createToken } from "./auth";

export async function createTestCookie(userId: string): Promise<string> {
    return createToken({ sub: userId });
}
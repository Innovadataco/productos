export function requireEnv(name: string, minLength = 1): string {
    const value = process.env[name];
    if (!value || value.trim().length < minLength) {
        throw new Error(
            `Missing or invalid environment variable: ${name} (required, min ${minLength} chars)`
        );
    }
    return value;
}
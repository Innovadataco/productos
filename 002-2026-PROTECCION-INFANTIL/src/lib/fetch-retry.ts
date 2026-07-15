export interface FetchRetryOptions extends RequestInit {
    maxRetries?: number;
    baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch con reintentos automáticos para errores transitorios.
 * - Errores de red y status 5xx se reintentan.
 * - Status 4xx se devuelven sin reintentar (error del cliente).
 */
export async function fetchWithRetry(
    url: string,
    options: FetchRetryOptions = {}
): Promise<Response> {
    const { maxRetries = 3, baseDelayMs = 1000, ...fetchOptions } = options;
    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, fetchOptions);
            if (res.ok) {
                return res;
            }
            // No reintentar errores 4xx
            if (res.status >= 400 && res.status < 500) {
                return res;
            }
            lastError = new Error(`HTTP ${res.status}`);
        } catch (err) {
            lastError = err;
        }

        if (attempt < maxRetries) {
            const delay = baseDelayMs * 2 ** attempt;
            await sleep(delay);
        }
    }

    if (lastError instanceof Error) {
        throw lastError;
    }
    throw new Error(" fetch falló después de reintentos");
}

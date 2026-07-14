import { useState, useCallback } from "react";

type ApiState<T> = {
    data: T | null;
    isLoading: boolean;
    error: string | null;
};

export function useApi<T>() {
    const [state, setState] = useState<ApiState<T>>({
        data: null,
        isLoading: false,
        error: null,
    });

    const request = useCallback(
        async (url: string, options?: RequestInit): Promise<T | null> => {
            setState({ data: null, isLoading: true, error: null });
            try {
                const res = await fetch(url, {
                    ...options,
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        ...options?.headers,
                    },
                });
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    const msg = json?.error?.message || `Error ${res.status}`;
                    setState({ data: null, isLoading: false, error: msg });
                    return null;
                }
                setState({ data: json, isLoading: false, error: null });
                return json;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error de conexión";
                setState({ data: null, isLoading: false, error: msg });
                return null;
            }
        },
        []
    );

    return { ...state, request };
}
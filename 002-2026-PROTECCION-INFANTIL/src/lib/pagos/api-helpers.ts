/**
 * Helpers comunes para endpoints admin de pagos (SPEC-212/214).
 */

export function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export function paginatedResponse<T>(items: T[], page: number, pageSize: number, total: number) {
    return {
        items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
    };
}

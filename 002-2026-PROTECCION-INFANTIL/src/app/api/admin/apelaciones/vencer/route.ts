import { NextResponse } from "next/server";
import { vencerApelacionesPendientes } from "@/lib/apelaciones";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { emptyBodySchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
    try {
        const secret = request.headers.get("x-worker-secret");
        if (secret !== process.env.WORKER_SECRET) {
            return NextResponse.json(
                { error: { message: "No autorizado", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        await withValidation.body(emptyBodySchema)(request);

        const result = await vencerApelacionesPendientes();
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

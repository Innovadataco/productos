import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export async function GET() {
    try {
        const settings = await prisma.moduleSetting.findMany({
            include: {
                aiModel: {
                    select: {
                        id: true,
                        name: true,
                        provider: true,
                        modelPath: true,
                        active: true
                    }
                }
            }
        });
        return NextResponse.json({ settings });
    } catch (error: unknown) {
        return apiError("Configuración", "module-settings", "Error en la configuración de módulos", 500, error);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const user = await verifyAuth();
        if (!user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        const body = await request.json();
        const { module, settingKey, aiModelId } = body;

        if (!module || !settingKey || !aiModelId) {
            return NextResponse.json(
                { error: "Campos requeridos: module, settingKey, aiModelId" },
                { status: 400 }
            );
        }

        const setting = await prisma.moduleSetting.upsert({
            where: {
                module_settingKey: {
                    module,
                    settingKey
                }
            },
            update: {
                aiModelId,
                updatedAt: new Date()
            },
            create: {
                module,
                settingKey,
                aiModelId
            },
            include: {
                aiModel: {
                    select: {
                        id: true,
                        name: true,
                        provider: true,
                        modelPath: true,
                        active: true
                    }
                }
            }
        });

        return NextResponse.json({ setting });
    } catch (error: unknown) {
        return apiError("Configuración", "module-settings", "Error en la configuración de módulos", 500, error);
    }
}

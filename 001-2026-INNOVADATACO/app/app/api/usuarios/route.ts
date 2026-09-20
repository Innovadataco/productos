import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  const usuarios = await prisma.user.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, email: true, rol: true },
  });
  return NextResponse.json(usuarios);
}

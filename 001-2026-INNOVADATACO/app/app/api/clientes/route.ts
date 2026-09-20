import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(clientes);
}

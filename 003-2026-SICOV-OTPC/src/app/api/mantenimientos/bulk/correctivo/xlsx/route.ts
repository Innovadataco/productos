import { manejarCargaMasiva } from "@/lib/mantenimientos/carga";

/// POST /api/mantenimientos/bulk/correctivo/xlsx — carga masiva XLSX de correctivos (US2, todo-o-nada).
export async function POST(req: Request) {
  return manejarCargaMasiva(req, 2, "xlsx");
}

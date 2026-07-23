import { manejarCargaMasiva } from "@/lib/mantenimientos/carga";

/// POST /api/mantenimientos/bulk/preventivo/xlsx — carga masiva XLSX de preventivos (US2, todo-o-nada).
export async function POST(req: Request) {
  return manejarCargaMasiva(req, 1, "xlsx");
}

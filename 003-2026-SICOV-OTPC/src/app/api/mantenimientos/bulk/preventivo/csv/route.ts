import { manejarCargaMasiva } from "@/lib/mantenimientos/carga";

/// POST /api/mantenimientos/bulk/preventivo/csv — carga masiva CSV de preventivos (D-019e, todo-o-nada).
export async function POST(req: Request) {
  return manejarCargaMasiva(req, 1, "csv");
}

import { manejarCargaMasiva } from "@/lib/mantenimientos/carga";

/// POST /api/mantenimientos/bulk/correctivo/csv — carga masiva CSV de correctivos (D-019e, todo-o-nada).
export async function POST(req: Request) {
  return manejarCargaMasiva(req, 2, "csv");
}

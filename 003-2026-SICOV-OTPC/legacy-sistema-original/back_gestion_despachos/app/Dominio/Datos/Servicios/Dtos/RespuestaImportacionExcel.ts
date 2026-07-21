import { ErrorFormatoImportarExcel } from "./ErrorFormatoImportarExcel";

export interface RespuestaImportacionExcel{
    errores: ErrorFormatoImportarExcel[]
    archivo: string
}
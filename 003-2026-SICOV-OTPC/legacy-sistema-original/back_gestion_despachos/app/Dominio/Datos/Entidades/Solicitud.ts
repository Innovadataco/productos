import { DateTime } from "luxon"

export class Solicitud{
  id?: number
  vigiladoId?: number
  verificadorId?: string
  estadoVigilado?: number
  fechaEnvioSt?: DateTime
  estadoVerificador?: number
  fechaEnvioStVerificador?: DateTime
  asignadorId?: string
  fechaAsignacion?: DateTime
  asignada?: boolean
}

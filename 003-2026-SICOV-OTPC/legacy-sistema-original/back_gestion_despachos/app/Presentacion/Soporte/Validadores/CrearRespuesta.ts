import { schema } from "@ioc:Adonis/Core/Validator"

export const crearRespuesta = schema.create({
    respuesta: schema.string(),
    adjunto: schema.file.optional()
}) 
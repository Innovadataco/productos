-- El interruptor del botón «Analizar con IA» (corrida a demanda del servicio inv-008-ia). Se enciende en /edicion/ia con
-- una versión nueva de config_ia (la tabla es de solo inserción: no se edita una fila). APAGADO por omisión: las filas
-- que ya existen y toda versión que no lo diga quedan con el análisis a demanda apagado (falla cerrada).
-- El límite por pedido (limiteSegundos) NO cambia aquí: la app acepta de 10 a 60 s y el lector acota a 60 lo que las
-- versiones viejas guardaron de más; la CHECK config_ia_limite_chk (10 a 120) queda como está para no invalidar la historia.
ALTER TABLE "config_ia" ADD COLUMN "analisisDemanda" BOOLEAN NOT NULL DEFAULT false;

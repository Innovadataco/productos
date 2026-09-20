-- Simplificar estados de oportunidad a ACTIVA/CERRADA
UPDATE oportunidades SET estado = 'ACTIVA' WHERE estado != 'CERRADA';

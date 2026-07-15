-- CreateIndex
CREATE UNIQUE INDEX "AlertaSuscripcion_usuarioId_identificador_plataformaId_key" ON "AlertaSuscripcion"("usuarioId", "identificador", "plataformaId");


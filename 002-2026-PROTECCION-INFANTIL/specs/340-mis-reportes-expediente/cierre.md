# Cierre · SPEC-340 · Mis reportes y el expediente · el hilo (A-68 · Fase 1)

**Fecha**: 01-09-2026 · **Rama**: `work/pi-SPEC-340-mis-reportes-expediente` · **Estado**: IMPLEMENTADO — pendiente del recorrido del CEO (candado 25)

## Qué se construyó

| Frente | Resultado |
|---|---|
| Las derogaciones | Expediente automático FUERA de la transacción del alta (la vinculación de #202 intacta) · auto-cierre derogado **incondicional** (ni un parámetro re-editado lo revive; bloque histórico comentado) · letrero y CTA de SPEC-324 fuera, con tests de ausencia |
| La cadena con casa propia | `Reporte.reportePrincipalId` (self-FK, SetNull, backfill con guardas) — la tesis del brief hecha esquema: la cadena existe siempre; el expediente es la vista |
| El hilo de datos | `GET cadenas` (tarjeta por cadena; el texto JAMÁS viaja) · `POST evento` (herencia en servidor; la cadena se escribe SIEMPRE — el caso «en dos o tres meses» vive fuera del dedup) · `POST expedientes` (el botón; idempotente en CUALQUIER estado; origen PADRE) |
| El step-up | Sello HMAC no transferible · `step-up` reusa el login completo (contador global probado) · `texto` es la ÚNICA vía del texto propio (sesión joven o sello; el listado nunca lo incluye; el PDF exento por diseño) |
| La capa 1 | `lecturaCapa1` PURA (12 casos: trampa UTC→Bogotá, bordes de ventana al segundo, anti-plantilla que lee el fuente) · ruta de lectura desde la cadena + ajenos blindados + cruce con hijos |
| El sello | Código impreso en cada página (decidido antes de renderizar) · hash sha256 del buffer FINAL (jamás dentro del PDF) · `InformePadre` inmutable (sin update/delete en ninguna capa, probado contra los exports) · verificación pública de TRES vías (comité por hash · padre por hash · padre por código) — un byte alterado NO verifica, probado |
| Los consumidores vivos | Home-timeline, sugerencia proactiva y estado vacío de /expedientes migrados a la cadena (aprobación CEO); el timeline del círculo NO se migró — su señal principal está intacta (decisión documentada) |
| La capa visible | Tarjetas por cadena con acordeón · texto tapado (el real nunca en el DOM) · Ver análisis con explicación parametrizada · AgregarEvento con campos fijos · ExpedienteVivo (mapa + Reproducir la historia con pausa/arrastre y reduced-motion · timeline mío/ajeno/anónimo · cifras de capa 1 · informes para siempre) · escudo en ámbar con alertas sin ver (solo padre) |

## Evidencia

- **~90 pruebas nuevas** de la spec en verde por módulo + suite completa (ver PR) + build + arch:check + tokens:check verdes.
- E2E `tests/e2e/mis-reportes-expediente.spec.ts` (390 px): cadena, texto ausente del HTML, expediente por botón, PDF registrado, prohibidos ausentes, sin desborde.
- Verificación cruzada adversarial (agente): 11 ROMPE + 10 DESACTUALIZADO detectados y aplicados ANTES del PR.

## Desviaciones y hallazgos (cambian el veredicto)

1. **La cadena no existía como el brief la asumía** — vivía solo dentro del expediente. La self-FK fue aprobada por el CEO y cambió el data-model (v2, con censo de callsites 22v5). El hueco `compilarExpediente` sin callsite de producción quedó anotado en el censo.
2. **La derogación del auto-cierre es INCONDICIONAL** (mi primera versión con `if (meses<=0)` era una valla que un parámetro revivía). Los tests que certificaban el cierre ahora certifican la derogación.
3. **El timeline del círculo no se migró a la cadena** — su señal principal (reportes visibles al identificador) está intacta; la pérdida real es la fila pre-clasificación entre vincular y clasificar. Aceptada y documentada.
4. **El grep binario del PDF no sirve** para afirmar el código impreso (texto por glifos embebidos): el contrato se prueba por construcción (dos códigos → renders distintos) + el hash del buffer entregado.
5. El detalle viejo del expediente (`ExpedienteDetalleClient`) queda sin montar tras el rediseño — se conserva el archivo; retirarlo es limpieza de otra pasada.

## Deuda declarada

- La rama `fijar:true` del handoff de reportar quedó sin llamador de producción (el CTA murió); limpiarla toca `reportar-handoff` compartido — fuera de alcance, anotada.
- `retapadoMinutos` en la UI usa el default (10); leer el parámetro vía config pública es un ajuste menor pendiente.
- El evento del motor `expediente.creado` sigue sin publicador (gap PRE-existente a esta spec, del censo del verificador).

## Pendiente para cerrar el ciclo

1. Recorrido del CEO (quickstart de 36+8 pasos, a 390 px).
2. E2E en pipeline.
3. Aceptación de Jelkin.

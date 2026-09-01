# Research · SPEC-340 · el hilo

**Fase 0** · 01-09-2026 · verificado contra `origin/main` = `0fa65d67a`.

## R-1 · Cómo se deroga el expediente automático sin romper la cadena

**Decisión**: en la transacción del alta (`api/reportes/route.ts:118-155`) se conserva TODO lo de la vinculación (advisory lock, evento enlazado, no-duplicación de #202) y se retira SOLO el bloque que crea/reutiliza el expediente. La creación pasa a `POST /api/padre/expedientes` (el botón), que toma la cadena del reporte y crea el expediente con `origenCreacion: "PADRE"`.

**Por qué así**: la vinculación y el expediente eran dos efectos pegados en una transacción por miedo al expediente a medias; al no crearse más expediente ahí, ese acople muere solo. El fix de #202 (no duplicar el evento del previo) vive en la parte de vinculación, que NO se toca.

**Alternativa descartada**: bandera «autoCrear=false» — dejaría el código muerto activo detrás de un if, la clase de trampa que el CEO acaba de hacer borrar (`esRutaExenta`).

## R-2 · A-3 resuelto: el historial del padre NO reusa `InformeConsolidado`

**Verificado**: `InformeConsolidado` exige `scoreValor`, `scoreGravedad`, `estadoAprobacion` (default `PENDIENTE_COMITE`) y cuelga aclaraciones del comité. Es el informe del FLUJO DE COMITÉ (SPEC-234/237/238).

**Decisión**: modelo propio **`InformePadre`**: `expedienteId`, `numeroSecuencial`, `pdfHash @unique`, `generadoEn`, `generadoPorId`. Sin score (el brief prohíbe puntajes al padre), sin estados de aprobación (nadie aprueba el informe del padre), sin campos editables (inmutabilidad real: solo `create` y `findMany` en el servicio; ningún `update`/`delete` existe).

**La verificación pública se revive extendiéndola**: `GET /api/publico/verificar-pdf/[hash]` busca hoy en `InformeConsolidado`; gana una segunda búsqueda en `InformePadre`. Un solo endpoint, dos fuentes, misma respuesta.

## R-3 · El sello en el PDF

**Decisión**: `generarPdfExpediente` gana pie de página con fecha/hora de generación (zona América/Bogotá, formateada en español) y el código de verificación = los primeros 16 caracteres del hash SHA-256 del PDF **sin el pie**, calculado en dos pasadas: (1) generar el cuerpo, (2) hash, (3) estampar pie con fecha + código + URL pública. La verificación pública compara contra el hash completo almacenado.

**Por qué dos pasadas**: estampar el hash DENTRO del PDF cambia el archivo — el hash impreso no puede ser el del archivo final. El patrón de SPEC-234 ya resuelve esto (hash del contenido canónico); se replica, no se inventa.

**Verificar en implementación**: cómo exactamente SPEC-234 canonicaliza (leer `generar-pdf.ts:141` y copiar SU contrato para que la página pública sirva a ambos sin ramas).

## R-4 · El step-up del texto sensible

**Decisión** (dos relojes, dos autoridades):
- **Re-tapado (N min, semilla 10)**: reloj del CLIENTE en `TextoSensible` — es ergonomía anti-miradas, no seguridad dura.
- **Umbral de contraseña (M min, semilla 30)**: autoridad del SERVIDOR. Las rutas que devuelven texto propio lo devuelven **solo** si la edad de sesión < M o si hay un sello de step-up fresco. `POST /api/padre/step-up` revalida la contraseña (misma verificación del login, MISMO contador de intentos global — sin contador paralelo) y deja una marca temporal en la sesión.
- El texto viaja tapado por defecto: las rutas de listado devuelven `textoDisponible: boolean` y el texto solo llega por la ruta de detalle que aplica la regla — el cliente no puede «destapar» lo que nunca recibió.

**Alternativa descartada**: tapar solo con CSS/blur en cliente con el texto ya presente en el DOM — teatro de seguridad; cualquier «ver código fuente» lo revela.

## R-5 · La edad de sesión

**Verificado**: el JWT de sesión lleva `iat` (se firma en login). **Decisión**: la edad de sesión = ahora − `iat` del JWT; el sello de step-up = cookie firmada de vida corta (M min) emitida por `step-up` — mismo patrón HMAC de `sesion_estado`, cookie separada (`stepup_sello`) para no engordar la cookie caliente del middleware.

## R-6 · La simulación del mapa

**Verificado**: `MapaUbicaciones` (Leaflet) pinta puntos estáticos. **Decisión**: la reproducción es estado del cliente (índice cronológico + reloj) que alimenta al mapa con el subconjunto visible y llama `fitBounds` cuando entra una ciudad fuera del encuadre (cubre el «se amplía solo» y el caso de otro país). Barra = `input range` sobre el índice. Sin dependencias nuevas, sin animación que viole `prefers-reduced-motion` (con motion reducido: salto directo sin interpolación).

## R-7 · Capa 1 — reglas como módulo puro

**Decisión**: `lectura-capa1.ts` recibe `{ hechos: [{fecha, ciudad, pais, clasificacion, esPropio, esAnonimo, edadReportada}] }` y devuelve cifras tipadas: franjas (bloques de 3 h con conteo), escalada (primera→última clasificación si difieren), aceleración (hechos en ventana reciente vs anterior), alcance (autores distintos estimados por el dato blindado), perfil (rango de edades + cruce con hijos del padre por identificador). **Textos**: cada cifra tiene UNA forma de presentarse — datos ordenados, sin adjetivos; las plantillas interpretativas quedan prohibidas por diseño (no existe donde escribirlas).

**Por qué puro**: se prueba con tablas de casos sin BD, y SPEC-341 le pasa el MISMO resultado al modelo (los hechos son de reglas; la IA interpreta lo calculado — regla de Jelkin).

## R-8 · Explicaciones por categoría

**Decisión**: parámetros `padre.analisis.explicacion.<CATEGORIA>` sembrados con texto inicial en la voz del brief para las categorías del clasificador, editables por el administrador (regla vigente: sembrar parametrizables). Fallback si falta la clave: texto genérico sereno + log para sembrarla.

## R-9 · El escudo

**Verificado**: `Guardian` acepta estado `calma|alerta`; `GET /api/notificaciones/resumen` devuelve `{noLeidas}`; `NavHeader` monta el Guardian sin señal. **Decisión**: `NavHeader` (solo rol padre) consulta el resumen al montar y al volver el foco; `noLeidas > 0` → `alerta`. Sin polling agresivo: al montar, al foco, y tras marcar leídas.

## Riesgos y cobertura

| Riesgo | Cobertura |
|---|---|
| Reescribir la transacción caliente (#202 de ayer) | Derogación PRIMERO y sola en un commit, con la suite completa de reportes/cadena antes de seguir |
| El step-up alimenta el bloqueo de cuenta por error | Reusa el contador global con su límite ya probado; test del caso contraseña errada |
| Inmutabilidad cosmética | El servicio no expone update/delete; test que verifica que no existen rutas de mutación |
| El único expediente de prod (origen automático) | `origenCreacion` default `"AUTOMATICO"` para filas existentes; test de migración |
| Verificación pública con dos fuentes | Contrato único de respuesta; test de hash de cada fuente y de hash inexistente |

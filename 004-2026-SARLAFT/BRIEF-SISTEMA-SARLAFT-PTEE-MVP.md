# BRIEF — Sistema de Gestión SARLAFT/PTEE para Sector Transporte

> **Rol del autor:** Arquitecto de Soluciones  
> **Destinatario:** Equipo de desarrollo (IA)  
> **Objetivo:** Definir el alcance funcional, técnico y de negocio del MVP de un sistema de gestión y seguimiento de cumplimiento SARLAFT/PTEE para entidades del sector transporte supervisadas por la Superintendencia de Transporte.  
> **Generado:** 2026-08-12 · Autor: ZEUS

---

## 1. Visión del producto

Un sistema web/SaaS que permita a empresas del sector transporte **clasificar automáticamente su régimen de cumplimiento (SARLAFT o RMS)**, gestionar las políticas, procedimientos, debidas diligencias, capacitaciones, reportes y evidencias exigidas por la Supertransporte, y mantenerse al día con los plazos vigentes sin dependencia de planillas Excel dispersas.

## 2. Objetivos del MVP

1. **Automatizar la clasificación** SARLAFT vs RMS según ingresos del año anterior.
2. **Centralizar las políticas y procedimientos** con control de versiones, aprobación y trazabilidad.
3. **Gestionar la matriz de riesgos LA/FT/FP** y su ciclo de revisión.
4. **Registrar la debida diligencia** de contrapartes con exclusiones automáticas (usuarios de transporte público).
5. **Llevar el control de capacitaciones** del oficial de cumplimiento y personal clave.
6. **Preparar y trackear reportes** ante UIAF (ROS/AROS) y Supertransporte (VIGÍA 2).
7. **Administrar el PTEE** con publicación web mínima y registro de reportes a entidades competentes.
8. **Alertar vencimientos** críticos (implementación, certificación, reportes trimestrales).
9. **Generar un dashboard de cumplimiento** para la dirección y el oficial de cumplimiento.

## 3. Fuera de alcance (MVP)

- Firma digital certificada con entidades públicas (se simula como paso de workflow).
- Integración directa con SIREL/UIAF (se registra manualmente el acuse de envío).
- Módulos de SICOV (CDA, CALE, CRC, CEA) — esos son subsistemas separados de control y vigilancia.
- App móvil nativa.
- Multi-tenancy avanzado (el MVP puede ser single-tenant con datos de una empresa a la vez).

---

## 4. Módulos funcionales

### Módulo 1: Configuración de la entidad
**Propósito:** registrar la empresa y determinar su régimen aplicable.

**Submódulos:**
- **1.1 Datos de la entidad:** NIT, razón social, dirección, representante legal, oficial de cumplimiento designado, sector específico (carga, pasajeros, mixto).
- **1.2 Carga de ingresos:** ingreso de ingresos totales del año anterior (en UVB o COP). Campo de historial anual.
- **1.3 Clasificación automática de régimen:** lógica que compara ingresos contra 142.206,50 UVB y asigna SARLAFT completo o RMS. Debe recalcularse cada año y alertar cambios.
- **1.4 Exclusiones:** checkbox para marcar si es “Empresa Desintegradora de Vehículos” (excluida del SARLAFT según Resolución 16615).

**Reglas de negocio:**
- Si ingresos >= 142.206,50 UVB → SARLAFT completo.
- Si ingresos < 142.206,50 UVB → RMS.
- Corte: 31 de diciembre del año inmediatamente anterior.
- Recalcular automáticamente cada 1 de enero.

---

### Módulo 2: Políticas y procedimientos
**Propósito:** gestionar el documento marco de cada sistema.

**Submódulos:**
- **2.1 Política SARLAFT:** CRUD con versionado, aprobación por máximo órgano social/junta directiva, fecha de vigencia, campos de versión y autor.
- **2.2 Política RMS:** mismo flujo, con contenido diferenciado según régimen.
- **2.3 Manual de procedimientos RMS:** para empresas en régimen simplificado.
- **2.4 Política PTEE:** CRUD con requisitos específicos de corrupción/soborno transnacional.
- **2.5 Código de ética / lineamientos:** documento base del PTEE.
- **2.6 Workflow de aprobación:** estado de borrador → en revisión → aprobado → vigente → obsoleto. Registro de aprobadores y fechas.

**Reglas de negocio:**
- Solo una política activa por tipo a la vez.
- Al crear nueva versión, la anterior pasa a obsoleta pero se conserva para auditoría.
- El sistema debe alertar si la política supera 12 meses sin actualización.

---

### Módulo 3: Matriz de riesgos LA/FT/FP
**Propósito:** capturar la identificación, evaluación y tratamiento de riesgos.

**Submódulos:**
- **3.1 Tipos de riesgo:** predefined list (LA, FT, FP) + riesgo específico del transporte (ej.: ruta irregular, sobrefacturación, vehículos de doble uso).
- **3.2 Evaluación:** probabilidad, impacto, controles existentes, riesgo residual.
- **3.3 Controles:** administrativos, técnicos, tecnológicos. Responsable, fecha de implementación, periodicidad de monitoreo.
- **3.4 Historial de cambios:** registro de modificaciones de la matriz.

**Reglas de negocio:**
- La matriz debe estar aprobada por el máximo órgano social.
- El sistema debe alertar controles con fecha de próxima verificación vencida.
- Debe permitir exportar a PDF/Excel para presentación a Supertransporte.

---

### Módulo 4: Debida diligencia de contrapartes
**Propósito:** gestionar el conocimiento de clientes y proveedores.

**Submódulos:**
- **4.1 Tipos de contrapartes:** cliente, proveedor, contratista, aliado.
- **4.2 Formulario de registro:** datos de identificación, actividad económica, país, productos/servicios, vinculación con grupos de riesgo.
- **4.3 Consulta de listas restrictivas:** campo de texto libre para registrar resultado de consulta (OFAC, ONU, lista de vinculados, etc.). No hay API pública integrada en MVP; se registra manualmente.
- **4.4 Excepciones:** justificación documentada para casos donde no aplica debida diligencia completa.
- **4.5 Exclusión automática usuarios de transporte de pasajeros:** si la entidad es de pasajeros, los usuarios finales no se registran como clientes (Resolución 4607).

**Reglas de negocio:**
- Para SARLAFT completo: debida diligencia estándar.
- Para RMS: debida diligencia simplificada proporcional al riesgo.
- Debe mostrar el porcentaje de contrapartes evaluadas vs. total.

---

### Módulo 5: Gestión del oficial de cumplimiento
**Propósito:** llevar el control del perfil, certificación y actividades del OC.

**Submódulos:**
- **5.1 Datos del OC principal:** nombre, documento, formación, experiencia, curso UIAF, certificación ISO/IEC 17024, número de empresas en las que ejerce.
- **5.2 Datos del OC suplente:** mismos campos, con fecha de designación.
- **5.3 Límite de empresas:** alerta cuando el OC principal o suplente supera 10 empresas (excepto grupos empresariales).
- **5.4 Incompatibilidades:** checklist que impide designar a personas que pertenezcan a administración, órganos sociales, revisoría fiscal o auditoría interna.
- **5.5 Historial de designaciones:** registro de cambios de OC.

**Reglas de negocio:**
- No permite guardar un OC sin certificación ISO/IEC 17024 vigente (fecha de vencimiento).
- No permite guardar un OC suplente sin curso UIAF aprobado.

---

### Módulo 6: Capacitaciones
**Propósito:** registrar capacitaciones en materia LA/FT/FP y PTEE.

**Submódulos:**
- **6.1 Catálogo de capacitaciones:** nombre, tema, contenido, proveedor, duración, vigencia.
- **6.2 Registro por empleado:** selección de empleado, capacitación, fecha, evidencia (certificado, lista de asistencia).
- **6.3 Vencimientos:** alerta cuando una capacitación está por vencer o ya venció.
- **6.4 Estadísticas:** porcentaje de personal capacitado por área.

**Reglas de negocio:**
- El oficial de cumplimiento debe tener capacitación vigente siempre.
- Las capacitaciones tienen vigencia máxima de 12 meses por defecto (configurable).

---

### Módulo 7: Reportes UIAF
**Propósito:** llevar la trazabilidad de los reportes de operaciones sospechosas.

**Submódulos:**
- **7.1 Registro de ROS:** tipo (ROS, AROS, reporte objetivo), fecha de hecho, descripción, contraparte involucrada, monto, fecha de envío, acuse de recibo UIAF.
- **7.2 AROS (ausencia de ROS):** registro por periodo (mes/trimestre) cuando no hay operaciones sospechosas.
- **7.3 Trazabilidad de envíos:** relación con casos específicos, número de radicado UIAF, adjuntos.
- **7.4 Alertas:** recordatorio de envío según periodicidad definida por UIAF en anexos técnicos.

**Reglas de negocio:**
- No se puede marcar un periodo como “sin ROS” si hay un ROS registrado en ese mismo periodo.
- Cada ROS debe estar vinculado a una evaluación de riesgo o a una diligencia de contraparte.

---

### Módulo 8: Reportes VIGÍA 2 (Supertransporte)
**Propósito:** preparar la información para el reporte trimestral en SINST-VIGÍA 2.

**Submódulos:**
- **8.1 Periodos de reporte:** Q1 (ene-mar, vence 10 abr), Q2 (abr-jun, vence 10 jul), Q3 (jul-sep, vence 10 oct), Q4 (oct-dic, vence 10 ene).
- **8.2 Formulario de reporte:** campos oficiales replicados (datos del OC, contrapartes evaluadas, capacitaciones, listas restrictivas, auditorías).
- **8.3 Generador de archivo:** exporta JSON/CSV/Excel según especificación oficial.
- **8.4 Historial de reportes:** registro de envíos, fechas, acuses, observaciones.
- **8.5 Alerta de vencimiento:** 15 días antes de cada corte.

**Reglas de negocio:**
- El primer reporte post-transición puede ser especial (may-jul hasta 10 ago 2026); el sistema debe permitir configurar periodos no estándar.

---

### Módulo 9: PTEE
**Propósito:** gestionar el Programa de Transparencia y Ética Empresarial.

**Submódulos:**
- **9.1 Políticas de gestión del riesgo de corrupción:** CRUD con control de versiones.
- **9.2 Deberes de empleados expuestos:** registro de cargos, funciones, exposiciones específicas.
- **9.3 Canal de reporte:** registro de casos reportados, seguimiento, estado (abierto, en investigación, cerrado), medidas disciplinarias aplicadas.
- **9.4 Capacitaciones PTEE:** vinculadas al módulo 6 pero con tema PTEE.
- **9.5 Publicación web mínima:** genera automáticamente una página web con secciones: líneas éticas, protección al denunciante, PQRSF, código de ética, gobierno corporativo, programa PTEE.
- **9.6 Reportes externos:** registro de envíos a UIAF, Secretaría de Transparencia, Superintendencia de Sociedades.

**Reglas de negocio:**
- Si la empresa está en RMS (<142.206,50 UVB), puede designar un Responsable de Cumplimiento PTEE (nivel 2 jerárquico) en lugar de Oficial de Cumplimiento pleno.
- La publicación web debe ser exportable como HTML/CSS estático.

---

### Módulo 10: Seguimiento de plazos y alertas
**Propósito:** motor de notificaciones para todas las fechas críticas.

**Submódulos:**
- **10.1 Calendario de vencimientos:** implementación SARLAFT/RMS, PTEE, certificación ISO, reportes UIAF, reportes VIGÍA 2.
- **10.2 Tipos de alerta:** email, notificación en sistema, para OC, dirección, junta directiva.
- **10.3 Configuración:** días de anticipación, destinatarios por tipo de alerta.
- **10.4 Historial:** log de alertas enviadas y leídas.

**Alertas críticas mínimas:**
- 30, 15 y 5 días antes de implementación SARLAFT/RMS.
- 30 y 15 días antes de primer reporte VIGÍA 2.
- 30 días antes de vencimiento de certificación ISO OC.
- 7 días antes de cada reporte trimestral VIGÍA 2.
- 15 días antes de plazo PTEE (18 ago 2026).

---

### Módulo 11: Dashboard y reportes ejecutivos
**Propósito:** vista consolidada del estado de cumplimiento.

**Submódulos:**
- **11.1 Estado general:** porcentaje de cumplimiento por módulo.
- **11.2 Semáforo de riesgos:** indicadores de vencimientos próximos, pendientes críticos, no conformidades.
- **11.3 Registro de auditorías:** fechas de visita Supertransporte, hallazgos, planes de mejoramiento.
- **11.4 Exportación:** informe ejecutivo en PDF para junta directiva o revisoría fiscal.

---

## 5. Arquitectura técnica (recomendación)

### 5.1 Stack sugerido
- **Backend:** Node.js + Express o Python + FastAPI. Elegir según equipo de desarrollo.
- **Frontend:** React o Vue.js con dashboard de componentes (Chart.js o similar para semáforos).
- **Base de datos:** PostgreSQL (relacional, ideal para trazabilidad y reportes).
- **Autenticación:** JWT + RBAC (roles: Admin, Oficial de Cumplimiento, Auditor, Director).
- **Notificaciones:** email SMTP + cola de tareas (BullMQ o Celery).
- **Generación de documentos:** Puppeteer o python-docx para PDFs de políticas y reportes.
- **Despliegue:** Docker + docker-compose. Sin dependencia de nube pública obligatoria; puede ser on-premise.

### 5.2 Consideraciones de seguridad
- Encriptación de datos sensibles (políticas, nombres de empleados, datos de contrapartes) en reposo.
- Logs de auditoría inmutables (quién cambió qué y cuándo).
- Cumplimiento con Ley 1581 de 2012 (protección de datos personales) — obligatorio en Colombia.
- Backup automático diario.

### 5.3 Escalabilidad
- El MVP es single-tenant por empresa. Si se vuelve multi-empresa, agregar esquema/tenant por NIT.
- Los reportes VIGÍA 2 son trimestrales y por empresa; no requieren escalado masivo.

---

## 6. Consideraciones de negocio

### 6.1 Usuarios objetivo por rol
| Rol | Funcionalidades principales |
|---|---|
| **Representante legal / Junta Directiva** | Aprobación de políticas, dashboard ejecutivo, alertas de vencimiento crítico. |
| **Oficial de Cumplimiento** | Gestión diaria: matriz de riesgos, debida diligencia, capacitaciones, reportes UIAF/VIGÍA 2, PTEE. |
| **Revisoría fiscal** | Consulta de reportes, alerta de inconsistencias SARLAFT, trazabilidad. |
| **Auditor interno** | Consulta de evidencias, estado de cumplimiento, registros de auditoría. |
| **Empleados** | Consulta de políticas, registro de capacitaciones, canal de reporte PTEE. |

### 6.2 Modelo de pricing sugerido (si es SaaS)
- **Por empresa:** tarifa anual según régimen (SARLAFT vs RMS) y número de empleados.
- **RMS:** tarifa reducida (carga administrativa menor).
- **SARLAFT:** tarifa completa.
- **Incluye:** actualizaciones normativas, soporte, generación de reportes oficiales.

### 6.3 Diferenciadores competitivos
- **Motor de clasificación automática** por UVB — único en el mercado.
- **Generador automático de página web PTEE** — ahorra consultoría externa.
- **Templates oficiales** preconfigurados según resoluciones vigentes (4607, 7038, etc.).
- **Actualizaciones normativas** como servicio — cuando Supertransporte emite nueva resolución, el sistema ajusta campos y alertas sin reimplementación.

---

## 7. Criterios de aceptación del MVP

### Debe cumplir sí o sí
1. Cargar ingresos del año anterior y obtener clasificación automática SARLAFT/RMS.
2. CRUD completo de políticas SARLAFT, RMS y PTEE con control de versiones y workflow de aprobación.
3. CRUD de matriz de riesgos LA/FT/FP con alertas de vencimiento de controles.
4. CRUD de debida diligencia de contrapartes con exclusión automática de usuarios de pasajeros.
5. CRUD de capacitaciones con vencimientos y alertas.
6. Registro de ROS/AROS con trazabilidad y alertas de periodicidad UIAF.
7. Generación del formulario de reporte VIGÍA 2 para un periodo trimestral.
8. Registro de casos PTEE, publicación web mínima generable, y registro de reportes a entidades externas.
9. Motor de alertas por email con al menos: certificación ISO, reportes VIGÍA 2, implementación SARLAFT/RMS.
10. Dashboard con estado de cumplimiento general y semáforo de riesgos.

### Criterios de calidad
- Tiempo de carga < 3 segundos por pantalla.
- Disponibilidad 99.5% en producción.
- Exportación de políticas y reportes a PDF con formato oficial.
- Accesibilidad: cumplimiento WCAG 2.1 nivel AA.

---

## 8. Roadmap sugerido

### Fase 1 — MVP (8-10 semanas)
- Módulos 1, 2, 3, 10 (clasificación, políticas, matriz, alertas).
- Módulos 4, 5 (debida diligencia, oficial de cumplimiento).
- Módulo 11 básico (dashboard simple).

### Fase 2 — Cumplimiento operativo (6-8 semanas)
- Módulo 6 (capacitaciones).
- Módulo 7 (reportes UIAF).
- Módulo 8 (reportes VIGÍA 2).
- Mejoras en dashboard.

### Fase 3 — PTEE y pulido (4-6 semanas)
- Módulo 9 completo (PTEE).
- Publicación web automática.
- Exportaciones avanzadas.
- Pruebas de carga y seguridad.

---

## 9. Entregables del proyecto

1. **Repositorio de código** con ramas por módulo, README de despliegue.
2. **Scripts de base de datos** (migraciones) y seed data de prueba.
3. **Manual de usuario** por rol (representante legal, oficial de cumplimiento, auditor).
4. **Manual técnico** de arquitectura, APIs y despliegue.
5. **Plan de pruebas** unitarias, integración y aceptación por criterios del §7.
6. **Documento de configuración** de alertas y recordatorios.
7. **Templates de documentos** oficiales (políticas SARLAFT, RMS, PTEE) en formato editable.
8. **Plan de actualizaciones normativas** (procedimiento para cuando Supertransporte modifique resoluciones).

---

## 10. Supuestos y dependencias

- El usuario final conoce el marco SARLAFT/PTEE y puede validar el contenido de las políticas.
- Las empresas tienen acceso a sus estados financieros para calcular UVB.
- La UIAF no expone API pública para SIREL; el sistema registra acuses manuales.
- La certificación ISO/IEC 17024 es provista por entes externos; el sistema solo alerta vencimientos.
- El MVP no requiere integración con sistemas contables existentes; la carga de ingresos es manual.

---

## 11. Métricas de éxito del MVP

- **Tiempo de implementación:** una empresa nueva configura su régimen y carga políticas iniciales en < 4 horas.
- **Reducción de errores:** 0 discrepancias entre régimen aplicado y requisitos exigidos por Supertransporte.
- **Cumplimiento de plazos:** 100% de alertas de vencimiento entregadas con 15 días de anticipación.
- **Satisfacción:** el oficial de cumplimiento puede generar el reporte VIGÍA 2 en < 30 minutos.
- **Cobertura normativa:** 100% de las obligaciones de Resoluciones 2328, 16615, 4607, 7038 y Circular 20265330000054 mapeadas a módulos del sistema.

---

> **📋 Control del documento** · v1.0 · 2026-08-12 · Autor: ZEUS  
> _Brief funcional y técnico para desarrollo de MVP de Sistema SARLAFT/PTEE. Este documento es la fuente única de verdad para el equipo de desarrollo; cualquier divergencia debe consultarse con el arquitecto antes de implementar._

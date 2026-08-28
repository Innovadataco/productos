# SPEC-002 · research.md

## Decisión D-12 · pg_logical vs alternativas

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| **pg_logical** (elegida) | Datos casi en vivo (1-5s lag) · tablas selectivas · sin downtime continuo · publicación con lista explícita (privacidad D-20) | 60s downtime único en pi-db para cambiar `wal_level=logical` |
| pg_basebackup streaming | Réplica física completa · cero configuración SQL | Copia TODO incluyendo PII · no permite filtrar tablas · alto ancho de banda |
| Dump nightly (pg_dump) | Cero cambios en pi-db | Datos de hasta 24h de antigüedad · inaceptable para chat en vivo Fase 2 · no sirve para dashboards operativos |
| Debezium + Kafka | Muy granular · baja latencia | Complejidad alta · 2 servicios extra · innecesario para el volumen de IDC |

**Conclusión:** pg_logical es la opción correcta: datos frescos, privacidad por filtrado de tablas, un único downtime de setup de 60s.

---

## Decisión D-20 · Réplica excluye tablas PII (Ley 1581)

**Tablas EXCLUIDAS de la publicación:**
- `Usuario` — datos personales del titular (nombre, email, teléfono)
- `Password` — hash de contraseña
- `Session` — tokens de sesión activos

**Tablas INCLUIDAS (23 · solo operativas · verificadas en schema PI 2026-08-28):**
```
Reporte · ClasificacionIA · ClasificacionRubricaVoto · CorreccionAdmin ·
EmbeddingReporte · TransicionReporte · SolicitudComite · FuenteReporte ·
Subscription · BillingCycle · Plan · Tenant ·
Colegio · Curso · Alumno · IdentificadorAlumno ·
AlertaColegio · AlertaSuscripcion · Plataforma ·
Pais · Departamento · Ciudad · AuditLog
```

**Razón legal:** Ley 1581 de 2012 (Colombia) · datos personales de menores requieren protección especial. El BI solo necesita datos operativos (cuántos reportes, qué categorías, qué colegios) no datos de identidad.

**Candado 13** (sanitizer PII) aplica de todas formas en el path de respuesta al usuario como segunda línea de defensa.

---

## Decisión D-13 · Tabla de puertos

| Puerto | Servicio | Razón |
|---|---|---|
| 3001 | bi-next (externo) | PI usa 3000 · separación |
| 5433 | bi-db-replica | PI usa 5432 · separación |
| 5434 | bi-superset-db | Puerto no usado en PI |
| 8001 | bi-vanna | FastAPI · convención |
| 8088 | bi-superset | Puerto default de Superset |

Todos los puertos expuestos en `127.0.0.1:XXXX` (solo localhost · Cloudflare Tunnel maneja el acceso externo).

---

## Decisión D-14 · Cloudflare Tunnel vs Certbot

| Opción | Pros | Contras |
|---|---|---|
| **Cloudflare Tunnel** (elegida) | PI ya lo usa (tunnel-id `970b8bb9-...`) · reutilizar · CNAME automático · renovación SSL automática · sin abrir puertos 80/443 | Dependencia Cloudflare |
| Certbot (Let's Encrypt) | Sin dependencia externa · estándar | Hay que abrir puertos · renovación cada 90 días · configurar nginx/caddy · más setup |

**Conclusión:** Cloudflare Tunnel ya está instalado y funcionando para PI. Agregar entry en `/etc/cloudflared/config.yml`: `hostname: tablero.pi.innovadataco.com → 127.0.0.1:3001`. Cero setup adicional.

---

## Decisión D-16 · JWT compartido vs auth propio BI

| Opción | Pros | Contras |
|---|---|---|
| **JWT compartido** (elegida) | Cero fricción · Jelkin ya tiene sesión PI · mismo cookie | Si cambia JWT_SECRET en PI hay que actualizar BI también |
| Auth propio BI | Independencia total | Segundo login · gestión de usuarios separada · sobredimensionado para Fase 1 interno (2 usuarios) |

**Conclusión:** JWT compartido con PI es lo correcto para Fase 1. Jelkin y Fábrica ya tienen sesión PI. En Fase 2 (módulos comerciales en PI) el JWT ya viene integrado naturalmente.

---

## Ajuste spec+plan · tablas PUBLICATION corregidas (2026-08-28)

**Detectado en:** bi-dev-2 lectura INSTRUCTIVO-002 v2 vs schema PI (`grep "^model" schema.prisma`).

**Gap:** spec.md v1 (escrita en SPEC-005 D3 sin verificar schema) tenía 14 tablas copiadas del BRIEF-A-01 v1:
`"Expediente"`, `"EventoExpediente"`, `"Notificacion"`, `"Suscripcion"`, `"Pago"`, `"Bono"`, `"Comuna"`, `"clasificacion_rubrica_votos"` — NINGUNA existe en el schema real de PI. Habrían causado error SQL en runtime.

**Corrección:** 23 tablas verificadas con `grep "^model" productos/002-2026-PROTECCION-INFANTIL/prisma/schema.prisma`. Todas existen ✅. Lista actualizada en spec.md y tasks.md (T-22).

**Resolución:** Candado 17 modificado → ajuste spec+plan commiteado y pusheado ANTES de implementar.

---

## Gap operativo · PI_NET_NAME no verificable en local (2026-08-28)

**Situación:** El docker-compose.yml de PI (dev) no define red nombrada explícita. La red de producción en el VPS es desconocida sin SSH. El INSTRUCTIVO-002 v2 indica que el nombre típico es `proteccion-infantil_pi-net` pero ordena verificar con `docker network ls | grep -i pi` en el VPS.

**Acción:** `.env.bi.example` usará placeholder `PI_NET_NAME=VERIFICAR_CON_DOCKER_NETWORK_LS_EN_VPS`. Jelkin verifica y completa en `.env.bi.production` en VPS. Placeholder anotado en `INVENTARIO-DE-SECRETOS.md`.

---

## Incidencia I-04 · spec+plan anterior perdido

**Qué pasó:** BI-DEV-1 escribió el spec+plan de SPEC-002 localmente, Fábrica lo revisó (R-008, REVISO emitido), pero cuando se descubrió I-02 (Spec Kit no inicializado) se emitió PARA. La sesión anterior terminó sin commitear el spec+plan. Se perdió.

**Candado 17 adoptado:** bi-dev-2 commitea el spec+plan ANTES de implementar (incluso este research.md forma parte del spec+plan de SPEC-002). Evita que se repita.

**Lección:** el spec+plan no es solo documentación interna de la sesión · es el artefacto oficial del proyecto. Debe vivir en git desde el momento en que existe.

---

## Hallazgo Fase A · candado 15 profundo (@@map)

| Modelo Prisma | Nombre real BD |
|---|---|
| `ClasificacionRubricaVoto` | `clasificacion_rubrica_votos` |
| `SimulacionRun` | `simulacion_runs` |
| `SimulacionReporte` | `simulacion_reportes` |

**Qué falló:** `grep "^model" schema.prisma` devuelve el nombre del modelo Prisma, no el nombre real de la tabla en BD cuando existe `@@map(...)`. El nombre del modelo se usó directamente en la PUBLICATION SQL con comillas dobles (`"ClasificacionRubricaVoto"`), que es incorrecto.

**Cómo se detectó:** Fábrica BI-2 ejecutó Fase A en VPS y `CREATE PUBLICATION ... "ClasificacionRubricaVoto"` falló con `ERROR: relation "ClasificacionRubricaVoto" does not exist` en pi-db producción.

**Corrección aplicada:** Fábrica corrigió en vivo con `clasificacion_rubrica_votos` sin comillas (snake_case · Postgres lo trata como identificador lowercase). SQL actualizado en 02-pi-db-publicacion.sql.

**Regla dura (candado 15 profundo):** verificar con `grep '^model'` **más** `grep '@@map'` **más** cross-check `psql -c '\dt'` cuando corresponda.

---

## Hallazgo Fase A · candidato candado 19 · secretos aleatorios sin stdout

Durante Fase A se expusieron 2 secretos en el chat (POSTGRES_PASSWORD de pi-db y
un password aleatorio v1 de bi_replica). El patrón corregido, propuesto como
candado 19 informal:

```bash
umask 077
openssl rand -base64 32 > ~/.tmp_secret
chmod 600 ~/.tmp_secret
# consumir en el mismo comando · nunca imprimir a pantalla:
PASS=$(cat ~/.tmp_secret) && [comando que usa $PASS] && unset PASS
shred -u ~/.tmp_secret
```

CEO decide formalización en CONSTITUTION.md v1.1 tras SPEC-002 CUMPLE.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 (reconstruida desde cero en SPEC-005 · I-04) |
| **F3C** | 2026-08-28 madrugada COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |

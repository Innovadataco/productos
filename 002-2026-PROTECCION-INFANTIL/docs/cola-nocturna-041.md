# Cola nocturna 002-PI-041 · Bitácora

Punto de retorno: etiqueta `pre-cola-041` → `9d7de9b79e50e81f8b7fe6b4da95c8b95250ac91`
(comando de vuelta: `git checkout pre-cola-041`, sin reescribir historia).

| Bloque | Qué | Rojos y causa | Arreglo (commit) | Para ZEUS |
|---|---|---|---|---|
| B-1 | Etiqueta de retorno pre-cola-041 | — | tag 9d7de9b7 | — |
| B0 | SPEC-110 Apelación: autenticado + evidencia PDF cifrada (AES-256-GCM, fuera de webroot) + comité decide + NUNCA ocultamiento automático + apelante solo ve N + job diario (aviso 10d, retención 30d) + enmienda constitucional verbatim | 33/33 (12 apelante + 17 comité + 4 mantenimiento), verificado por coordinador bajo candado | b60b688f, c841ed59, 1be8b290, a3131861, 0bf6c2bb, 1016bf0b, 8f926714, 0095ade4, ea447072 | Carreras de BD de test por bloques en paralelo (recomienda aislar BD o serializar gate); PerfilOperador.esRevisorDeApelaciones sigue inerte; IMPLEMENTADA SIN DESPLEGAR |
| B2 | SPEC-116 vista del padre: solo conductas confirmadas + plantilla D-23 + canales; fuera modelos/votos/%/descartadas | 0 propios (los 19 de su corrida eran de agentes en vuelo) | 6ec5d724, c4ed5d9b | Contrato nuevo en mis-reportes/[id] (in-place, único consumidor); índice README por coordinador |
| B4 | SPEC-118 clics muertos: proxy abre área pública de solo lectura a SCHOOL_ADMIN (/, dashboard-publico, seguimiento + sus APIs de lectura; /api/reportes POST sigue cerrada) + NavHeader sin destino bloqueado ni página actual (todos los roles) | 6 rojos primero (proxy ×2, header ×4) → 49/49 e2e + suite 1020/1022 (solo el fallo sancionado del índice) | dfe1279e, 87d40cf3, fc1fd390 | Footer (/privacidad, /terminos) sigue cerrado al colegio: fuera de la decisión, posible follow-up; /consulta no existe como página (vive en /) |
| B6 | a) ia/modelos degrada a 503 estructurado (patrón I-24); b) bcrypt nativo NO trivial → docs/deuda-bcrypt-nativo.md; c) spam.min_text_length cableado en wizard + ADR_004 con tests de efecto | 0 propios (28/28 verificados por coordinador) | d8231744, 88ece663, 78c8a55c | Bloqueo bcrypt nativo: docs/deuda-bcrypt-nativo.md (binarios en Docker/CI) |
| B8 | SPEC-120 smoke prod-safe: 5 roles login→acción→logout→401, cuentas efímeras FK-seguras, --dry-run/--db-only/--confirm-prod | 0 (5/5 roles PASS en local, ambas variantes de cookie) | 7b18021b, 4d612395 | Sin escritura de negocio (sin reporte de prueba): limitación documentada; primera corrida real en prod queda para ZEUS (runbook 12d) |

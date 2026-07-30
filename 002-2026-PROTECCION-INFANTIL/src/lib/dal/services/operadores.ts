/**
 * SPEC-053 (US3, módulo Operadores): OperadorService.
 * Gestión de operadores y comité (alta, edición, activación/desactivación,
 * regeneración de password), modelo de asignación y panel de distribución.
 * El envío de emails queda en su adaptador (`src/lib/email.ts`); los emails
 * de bienvenida los dispara la ruta con el password temporal devuelto aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getParametroSistema, descifrarValorParametro } from "@/lib/parametros";
import { obtenerConfigAsignacion } from "@/lib/operadores/asignador";
import { whereReporteVigente, whereReporteEnEstado } from "@/lib/reportes-acceso";
import type { EstrategiaAsignacion } from "@/lib/operadores/asignador";
import { UsuarioRepository } from "../repositories/usuario";
import { PerfilOperadorRepository } from "../repositories/perfil-operador";
import { ReporteRepository } from "../repositories/reporte";
import { SolicitudComiteRepository } from "../repositories/solicitud-comite";
import { ParametroRepository } from "../repositories/parametro";
import type {
    InfoClienteDto,
    ModeloAsignacionDto,
    OperadorConPerfil,
    OperadorListItemDto,
    PanelAsignacionDto,
    ResultadoCrearOperador,
} from "../types/operador";

function tempPassword() {
    return randomBytes(6).toString("hex");
}

function filtroTenant(admin: { rol: string; tenantId: string | null }) {
    if (admin.rol === "ADMIN") return {};
    return { tenantId: admin.tenantId ?? null };
}

export interface CrearOperadorInput {
    email: string;
    nombre: string;
    rol: "OPERADOR" | "COMITE_VALIDACION";
    cupoMaximo?: number;
    esRevisorDeApelaciones?: boolean;
    esComite: boolean;
    notasInternas?: string;
}

export class OperadorService {
    private readonly usuarios: UsuarioRepository;
    private readonly perfiles: PerfilOperadorRepository;
    private readonly reportes: ReporteRepository;
    private readonly solicitudes: SolicitudComiteRepository;
    private readonly parametros: ParametroRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.usuarios = new UsuarioRepository(tx);
        this.perfiles = new PerfilOperadorRepository(tx);
        this.reportes = new ReporteRepository(tx);
        this.solicitudes = new SolicitudComiteRepository(tx);
        this.parametros = new ParametroRepository(tx);
    }

    /** GET /api/admin/operadores — listado con conteos de casos. */
    async listar(admin: { rol: string; tenantId: string | null }): Promise<OperadorListItemDto[]> {
        const operadores = await this.usuarios.findOperadores({
            rol: { in: ["OPERADOR", "COMITE_VALIDACION"] },
            ...filtroTenant(admin),
        });

        return Promise.all(
            operadores.map(async (op) => {
                const casosAbiertos = op.rol === "OPERADOR"
                    ? await this.reportes.countWhere(whereReporteEnEstado("REVISION_MANUAL", { operadorId: op.id }))
                    : await this.solicitudes.countPorComite(op.id, ["PENDIENTE", "ASIGNADA"]);
                const casosTotales = op.rol === "OPERADOR"
                    ? await this.reportes.countWhere(whereReporteVigente({ operadorId: op.id }))
                    : await this.solicitudes.countPorComite(op.id);
                return {
                    id: op.id,
                    email: op.email,
                    nombre: op.nombre,
                    rol: op.rol as string,
                    estado: op.estado as string,
                    debeCambiarPassword: op.debeCambiarPassword,
                    tenantId: op.tenantId,
                    perfil: op.perfilOperador
                        ? {
                              cupoMaximo: op.perfilOperador.cupoMaximo,
                              esRevisorDeApelaciones: op.perfilOperador.esRevisorDeApelaciones,
                              esComite: op.perfilOperador.esComite,
                              notasInternas: op.perfilOperador.notasInternas,
                              creadoPorId: op.perfilOperador.creadoPorId,
                              ultimoEmailNotificacionEn: op.perfilOperador.ultimoEmailNotificacionEn,
                          }
                        : null,
                    casosAbiertos,
                    casosTotales,
                };
            })
        );
    }

    /** POST /api/admin/operadores — alta con perfil y password temporal. */
    async crear(
        input: CrearOperadorInput,
        admin: { id: string; tenantId: string | null }
    ): Promise<ResultadoCrearOperador & { password?: string }> {
        const existe = await this.usuarios.findByEmail(input.email);
        if (existe) {
            const esRolGestionado = existe.rol === "OPERADOR" || existe.rol === "COMITE_VALIDACION";
            if (esRolGestionado && input.rol !== existe.rol) {
                return { ok: false, tipo: "rol_distinto", rolExistente: existe.rol, rolNuevo: input.rol };
            }
            return { ok: false, tipo: "email_existente" };
        }

        const password = tempPassword();
        const passwordHash = await hashPassword(password);

        const operador = await this.usuarios.crearConPerfil({
            email: input.email,
            nombre: input.nombre,
            passwordHash,
            rol: input.rol,
            estado: "activo",
            debeCambiarPassword: true,
            tenantId: admin.tenantId,
            perfilOperador: {
                create: {
                    cupoMaximo: input.cupoMaximo ?? 10,
                    esRevisorDeApelaciones: input.esRevisorDeApelaciones ?? false,
                    esComite: input.esComite,
                    notasInternas: input.notasInternas,
                    creadoPorId: admin.id,
                },
            },
        });

        return {
            ok: true,
            operador: {
                id: operador.id,
                email: operador.email,
                nombre: operador.nombre,
                rol: operador.rol,
                estado: operador.estado,
                debeCambiarPassword: operador.debeCambiarPassword,
                perfil: operador.perfilOperador,
            },
            accionAudit: input.rol === "COMITE_VALIDACION" ? "COMITE_CREADO" : "OPERADOR_CREADO",
            password,
        };
    }

    /** Registra la auditoría del alta (la ruta la emite con su info de cliente). */
    async auditarAlta(input: {
        accion: "OPERADOR_CREADO" | "COMITE_CREADO";
        operadorId: string;
        adminId: string;
        valorNuevo: string;
        info: InfoClienteDto;
    }) {
        await logAudit({
            accion: input.accion,
            tipoRecurso: "Usuario",
            recursoId: input.operadorId,
            usuarioId: input.adminId,
            valorNuevo: input.valorNuevo,
            ipAddress: input.info.ipAddress,
            userAgent: input.info.userAgent,
        });
    }

    /** GET por id con perfil (guarda compartida de las subrutas). */
    obtenerOperador(id: string) {
        return this.usuarios.findOperadorById(id);
    }

    /** PATCH /api/admin/operadores/[id] — estado (con auditoría), nombre y perfil. */
    async actualizar(
        operador: OperadorConPerfil,
        cambios: {
            nombre?: string;
            cupoMaximo?: number;
            esRevisorDeApelaciones?: boolean;
            notasInternas?: string;
            estado?: "activo" | "inactivo";
        },
        adminId: string,
        info: InfoClienteDto
    ): Promise<OperadorConPerfil | null> {
        const { nombre, estado, ...perfilData } = cambios;

        if (estado && estado !== operador.estado) {
            await this.usuarios.actualizar(operador.id, { estado });
            const accionAudit = operador.rol === "COMITE_VALIDACION"
                ? (estado === "activo" ? "COMITE_ACTIVADO" : "COMITE_DESACTIVADO")
                : (estado === "activo" ? "OPERADOR_ACTIVADO" : "OPERADOR_DESACTIVADO");
            await logAudit({
                accion: accionAudit,
                tipoRecurso: "Usuario",
                recursoId: operador.id,
                usuarioId: adminId,
                valorAnterior: JSON.stringify({ estado: operador.estado }),
                valorNuevo: JSON.stringify({ estado }),
                ipAddress: info.ipAddress,
                userAgent: info.userAgent,
            });
        }

        if (nombre) {
            await this.usuarios.actualizar(operador.id, { nombre });
        }

        if (operador.perfilOperador && Object.keys(perfilData).length > 0) {
            await this.perfiles.actualizarPorUsuarioId(operador.id, perfilData);
        }

        return this.usuarios.findByIdConPerfil(operador.id);
    }

    /** DELETE /api/admin/operadores/[id] — baja lógica con auditoría. */
    async desactivar(operador: OperadorConPerfil, adminId: string, info: InfoClienteDto) {
        await this.usuarios.actualizar(operador.id, { estado: "inactivo" });
        const accionAudit = operador.rol === "COMITE_VALIDACION" ? "COMITE_DESACTIVADO" : "OPERADOR_DESACTIVADO";
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Usuario",
            recursoId: operador.id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: operador.estado }),
            valorNuevo: JSON.stringify({ estado: "inactivo" }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });
    }

    /** POST /api/admin/operadores/[id]/reactivar — alta lógica con auditoría. */
    async reactivar(operador: OperadorConPerfil, adminId: string, info: InfoClienteDto) {
        await this.usuarios.actualizar(operador.id, { estado: "activo" });
        const accionAudit = operador.rol === "COMITE_VALIDACION" ? "COMITE_ACTIVADO" : "OPERADOR_ACTIVADO";
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Usuario",
            recursoId: operador.id,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: operador.estado }),
            valorNuevo: JSON.stringify({ estado: "activo" }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });
    }

    /**
     * POST .../regenerar-password y .../reenviar-email — nuevo password temporal
     * y marca de cambio obligatorio. Devuelve el password para que la RUTA lo
     * muestre o lo envíe por email (adaptador).
     */
    async regenerarPassword(
        operador: OperadorConPerfil,
        adminId: string,
        info: InfoClienteDto,
        tipo: "regenerar" | "reenviar"
    ): Promise<{ password: string }> {
        const password = tempPassword();
        const passwordHash = await hashPassword(password);

        await this.usuarios.actualizar(operador.id, { passwordHash, debeCambiarPassword: true });

        const esComite = operador.rol === "COMITE_VALIDACION";
        const accionAudit = tipo === "reenviar"
            ? (esComite ? "COMITE_EMAIL_REENVIADO" : "OPERADOR_EMAIL_REENVIADO")
            : (esComite ? "COMITE_PASSWORD_REGENERADA" : "OPERADOR_PASSWORD_REGENERADA");
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Usuario",
            recursoId: operador.id,
            usuarioId: adminId,
            valorAnterior: tipo === "regenerar" ? JSON.stringify({ debeCambiarPassword: operador.debeCambiarPassword }) : undefined,
            valorNuevo: tipo === "regenerar" ? JSON.stringify({ debeCambiarPassword: true }) : JSON.stringify({ email: operador.email }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { password };
    }

    /** GET /api/admin/operadores/modelo — configuración efectiva de asignación. */
    async obtenerModelo(): Promise<ModeloAsignacionDto> {
        const [cupoParam, estrategiaParam] = await Promise.all([
            getParametroSistema("operadores.cupo_maximo_default"),
            getParametroSistema("operadores.estrategia_asignacion"),
        ]);

        return {
            cupoMaximoDefault: cupoParam ? parseInt(descifrarValorParametro(cupoParam).valor, 10) || 10 : 10,
            estrategia: (estrategiaParam ? descifrarValorParametro(estrategiaParam).valor : "ponderado_carga_inversa"),
        };
    }

    /** PATCH /api/admin/operadores/modelo — upsert de parámetros + auditoría. */
    async actualizarModelo(
        cambios: { cupoMaximoDefault?: number; estrategia?: EstrategiaAsignacion },
        usuarioId: string
    ): Promise<{ anterior: ModeloAsignacionDto; nuevo: ModeloAsignacionDto }> {
        const anterior = await this.obtenerModelo();

        if (cambios.cupoMaximoDefault !== undefined) {
            await this.parametros.upsert(
                "operadores.cupo_maximo_default",
                {
                    clave: "operadores.cupo_maximo_default",
                    valor: String(cambios.cupoMaximoDefault),
                    tipo: "INTEGER",
                    categoria: "SECURITY",
                    esPublico: false,
                    descripcion: "Cupo máximo default para operadores sin override explícito",
                },
                { valor: String(cambios.cupoMaximoDefault) }
            );
        }

        if (cambios.estrategia !== undefined) {
            await this.parametros.upsert(
                "operadores.estrategia_asignacion",
                {
                    clave: "operadores.estrategia_asignacion",
                    valor: cambios.estrategia,
                    tipo: "STRING",
                    categoria: "SECURITY",
                    esPublico: false,
                    descripcion: "Estrategia de asignación de casos a operadores",
                },
                { valor: cambios.estrategia }
            );
        }

        const nuevo = await this.obtenerModelo();

        await logAudit({
            accion: "CONFIGURACION_ASIGNACION_ACTUALIZADA",
            tipoRecurso: "ParametroSistema",
            recursoId: "operadores.asignacion",
            usuarioId,
            valorAnterior: JSON.stringify(anterior),
            valorNuevo: JSON.stringify(nuevo),
        });

        return { anterior, nuevo };
    }

    /** GET /api/admin/operadores/asignacion — panel de distribución de casos. */
    async panelAsignacion(): Promise<PanelAsignacionDto> {
        const [sinAsignar, operadoresRaw, distribucion, config] = await Promise.all([
            this.reportes.countWhere(whereReporteEnEstado("REVISION_MANUAL", { operadorId: null })),
            this.usuarios.findOperadoresActivosAsignacion(),
            this.reportes.groupByOperador(whereReporteEnEstado("REVISION_MANUAL", { operadorId: { not: null } })),
            obtenerConfigAsignacion(),
        ]);

        const casosPorOperador = new Map(distribucion.map((d) => [d.operadorId, d._count.operadorId]));

        const operadores = operadoresRaw.map((op) => {
            const casosAbiertos = casosPorOperador.get(op.id) ?? 0;
            const cupo = op.perfilOperador?.cupoMaximo ?? config.cupoDefault;
            return {
                id: op.id,
                email: op.email,
                nombre: op.nombre,
                esRevisorDeApelaciones: op.perfilOperador?.esRevisorDeApelaciones ?? false,
                casosAbiertos,
                cupoMaximo: cupo,
                libre: Math.max(0, cupo - casosAbiertos),
            };
        });

        return {
            sinAsignar,
            operadores,
            estrategia: config.estrategia,
            cupoDefault: config.cupoDefault,
        };
    }
}

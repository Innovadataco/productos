export class TokenExterno {
  private static _token: string | null = null
  private static _expiraEn: number | null = null
  private static _refreshEnCurso: Promise<string> | null = null

  // Guarda el token y (opcionalmente) un timestamp de expiración en epoch seconds
  public static set(token: string, expiraEn?: number) {
    this._token = token
    this._expiraEn = typeof expiraEn === 'number' ? expiraEn : null
  }

  public static async get(): Promise<string | null> {
    if (this.isVigente()) {
      return this._token
    }

    return this.refresh()
  }

  public static async refresh(): Promise<string | null> {
    if (this._refreshEnCurso) {
      return this._refreshEnCurso
    }

    const promesa = (async () => {
      try {
        const { ServicioAutenticacionExterna } = await import('App/Dominio/Datos/Servicios/ServicioAutenticacionExterna')
        const servicio = new ServicioAutenticacionExterna()
        const token = await servicio.iniciarSesionConEnv()
        this.set(token)
        return token
      } catch (error) {
        this.clear()
        throw error
      } finally {
        this._refreshEnCurso = null
      }
    })()

    this._refreshEnCurso = promesa
    return promesa
  }

  public static isVigente(): boolean {
    if (!this._token) return false
    if (!this._expiraEn) return true
    const ahora = Math.floor(Date.now() / 1000)
    return ahora < this._expiraEn
  }

  public static clear() {
    this._token = null
    this._expiraEn = null
  }
}

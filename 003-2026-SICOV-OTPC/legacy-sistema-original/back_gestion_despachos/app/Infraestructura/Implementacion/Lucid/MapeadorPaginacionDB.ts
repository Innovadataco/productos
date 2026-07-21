import { LucidRow, ModelPaginatorContract } from '@ioc:Adonis/Lucid/Orm'
import { Paginador } from 'App/Dominio/Paginador'
import { Paginable } from 'App/Dominio/Tipos/Tipos'

export class MapeadorPaginacionDB {

  public static obtenerPaginacion<T extends LucidRow>(paginador:ModelPaginatorContract<T>): Paginador {
    return new Paginador(paginador.total, paginador.currentPage, paginador.lastPage)
  }
}

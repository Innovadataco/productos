import '@ioc:Adonis/Core/Request'

declare module '@ioc:Adonis/Core/Request' {
  interface RequestContract {
    respuestaDatos?: any
  }
}
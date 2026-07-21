import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: true, credentials: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  const port = process.env.PORT ? Number(process.env.PORT) : 5050
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`\n  Gesmovil API · http://localhost:${port}/api/v1\n`)
}
bootstrap()

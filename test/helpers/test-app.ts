import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AppExceptionFilter } from '../../src/modules/common/filters/app-exception.filter';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { applyTestEnvDefaults } from './env';

export async function createTestApp() {
  applyTestEnvDefaults();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new AppExceptionFilter());

  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    config
  };
}

export async function closeTestApp(app: INestApplication | undefined) {
  if (app) {
    await app.close();
  }
}

import { appConfig } from "config/configuration";

async function bootstrap() {
  const appEnv = appConfig.appEnv;
  const appModulePath = `./${appEnv === 'api-gateway' ? `apps/${appEnv}` : `apps/${appEnv}`}/app.module`;

  // Dynamic import application
  const { AppModule } = await import(appModulePath);
  await AppModule.bootstrap();
}

bootstrap().catch(console.error);

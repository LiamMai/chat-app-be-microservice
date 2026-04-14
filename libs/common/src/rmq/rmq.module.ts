import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { getRmqOptions } from './rmq.options';

export interface RmqClientOptions {
  name: string;
  queue: string;
}

@Module({})
export class RmqModule {
  static register(options: RmqClientOptions | RmqClientOptions[]): DynamicModule {
    const clients = Array.isArray(options) ? options : [options];

    return {
      module: RmqModule,
      imports: [
        ClientsModule.register(
          clients.map(({ name, queue }) => ({
            name,
            ...getRmqOptions(queue),
          })),
        ),
      ],
      exports: [ClientsModule],
    };
  }
}

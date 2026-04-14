import { RmqOptions, Transport } from '@nestjs/microservices';
import { appConfig } from 'config/configuration';

export const getRmqOptions = (queue: string, noAck = true): RmqOptions => ({
  transport: Transport.RMQ,
  options: {
    urls: [appConfig.rabbitmq.url],
    queue,
    queueOptions: {
      durable: true,
    },
    noAck,
    persistent: true,
  },
});

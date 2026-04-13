export enum NodeEnv {
    Development = 'development',
    Production = 'production',
    Test = 'test',
}

const envConfig = process.env;

const getEnv = <T extends string>(key: T, defaultValue?: string): string => {
    const value = envConfig[key];
    return value || defaultValue || '';
}
export const appConfig = {
    port: parseInt(getEnv('PORT', '3000'), 10),
    nodeEnv: getEnv('NODE_ENV', 'development') as NodeEnv,
    cors: {
        origin: getEnv('CORS_ORIGIN', '*'),
        methods: getEnv('CORS_METHODS', '*').split(','),
        enable: getEnv('CORS_ENABLED', 'false').toLowerCase() === 'true',
    },
    postgres: {
        username: getEnv('POSTGRES_USERNAME', 'postgres'),
        password: getEnv('POSTGRES_PASSWORD', 'MyStr0ngPassword'),
        host: getEnv('POSTGRES_PRIMARY_HOST', 'localhost'),
        database: getEnv('APP_NAME', 'chat-app'),
        port: parseInt(getEnv('POSTGRES_PRIMARY_HOST_PORT', '5432'), 10),
    },
    mongo: {
        uri: getEnv('MONGODB_BASE_URL', 'mongodb://localhost:27017/chat-app'),
    },
    rabbitmq: {
        url: getEnv('RABBITMQ_URL', 'amqp://localhost:56720'),
    },
    appEnv: getEnv('APP_ENV', 'api-gateway') as 'api-gateway' | 'system' | 'user' | 'order' | 'content',

};
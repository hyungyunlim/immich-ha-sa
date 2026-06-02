import 'dotenv/config';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = createServer({ config });

const shutdown = async (): Promise<void> => {
  server.log.info('Shutting down frame controller');
  await server.close();
};

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});

await server.listen({ host: '0.0.0.0', port: config.port });


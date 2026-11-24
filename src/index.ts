import 'dotenv/config';
import { hostname } from 'node:os';
import { ControllerAuthManager } from './auth.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { JsonStore } from './store.js';

const config = loadConfig();
const store = new JsonStore(config.storePath, config.defaultDevice);
const auth = new ControllerAuthManager(store, config.controllerApiToken);
const server = createServer({ config, store, auth });

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
await offerToHomeAssistant();

// As a Home Assistant add-on, offer the controller to Home Assistant through
// Supervisor discovery, so the integration is set up without a pairing code.
async function offerToHomeAssistant(): Promise<void> {
  const supervisorToken = process.env.SUPERVISOR_TOKEN;
  if (!supervisorToken) return;
  const apiToken = auth.ensureDiscoveryToken();
  if (!apiToken) return;
  try {
    const response = await fetch('http://supervisor/discovery', {
      method: 'POST',
      headers: { authorization: `Bearer ${supervisorToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        service: 'immich_frame',
        // The add-on hostname resolves from Home Assistant on the internal
        // network, whatever host port (if any) the user maps.
        config: { url: `http://${hostname()}:${config.port}`, api_token: apiToken },
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    server.log.info('Offered the controller to Home Assistant through Supervisor discovery');
  } catch (error) {
    server.log.warn({ err: error }, 'Supervisor discovery failed; pair Home Assistant with a code instead');
  }
}

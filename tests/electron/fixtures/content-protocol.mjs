import { app, BrowserWindow, net, protocol } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerContentProtocol } from '../../../electron/services/content-protocol.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'toefl-content',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
]);

app.commandLine.appendSwitch('headless');
app.commandLine.appendSwitch('disable-gpu');

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));
const contentFile = process.argv.at(-1);

try {
  await app.whenReady();
  registerContentProtocol({
    protocol,
    net,
    resolveFile: relativePath => (relativePath === 'catalog.json' ? contentFile : null)
  });
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await window.loadFile(path.join(fixtureDirectory, 'content-protocol.html'));
  const result = await window.webContents.executeJavaScript(
    "fetch('toefl-content://content/catalog.json').then(response => response.text())"
  );
  process.stdout.write(`CONTENT_PROTOCOL_RESULT:${result}\n`);
  window.destroy();
  app.quit();
} catch (error) {
  process.stderr.write(`${error?.stack || error}\n`);
  app.exit(1);
}

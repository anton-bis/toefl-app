import { app, BrowserWindow, protocol } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerContentProtocol } from '../../../electron/services/content-protocol.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'toefl-content',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
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
    resolveFile: relativePath => (relativePath === 'catalog.json' ? contentFile : null)
  });
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await window.loadFile(path.join(fixtureDirectory, 'content-protocol.html'));
  const result = await window.webContents.executeJavaScript(`(async () => {
    const complete = await fetch('toefl-content://content/catalog.json');
    const range = await fetch('toefl-content://content/catalog.json', {
      headers: { Range: 'bytes=2-6' }
    });
    return {
      complete: await complete.text(),
      rangeStatus: range.status,
      contentRange: range.headers.get('content-range'),
      range: await range.text()
    };
  })()`);
  process.stdout.write(`CONTENT_PROTOCOL_RESULT:${JSON.stringify(result)}\n`);
  window.destroy();
  app.quit();
} catch (error) {
  process.stderr.write(`${error?.stack || error}\n`);
  app.exit(1);
}

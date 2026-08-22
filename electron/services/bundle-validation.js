import fs from 'node:fs';
import path from 'node:path';

const ABSOLUTE_ASSET_PATTERN = /(?:\s(?:src|href)=["'])\/assets\//;

export function hasAbsoluteAssetPaths(html) {
  return ABSOLUTE_ASSET_PATTERN.test(String(html || ''));
}

export function validateProductionBundle({ indexPath }) {
  let html = '';
  try {
    html = fs.readFileSync(indexPath, 'utf8');
  } catch {
    return {
      ok: false,
      reason: 'missing',
      message: [
        `Missing dist/index.html at: ${indexPath}`,
        '',
        'Build the app bundle before launching Electron:',
        '  npm run electron:dev',
        'or, in PowerShell:',
        '  $env:ELECTRON = "true"; npm run build'
      ].join('\n')
    };
  }
  if (hasAbsoluteAssetPaths(html)) {
    return {
      ok: false,
      reason: 'absolute-assets',
      message: [
        'dist/index.html uses absolute asset paths (/assets/...).',
        'Electron cannot load them over file://, which causes the blank screen.',
        '',
        'Rebuild with ELECTRON=true:',
        '  npm run electron:dev',
        'or, in PowerShell:',
        '  $env:ELECTRON = "true"; npm run build',
        '',
        'Then check dist/index.html references ./assets/... (relative).'
      ].join('\n')
    };
  }
  return { ok: true };
}

export function validateBundleFromMainPath(mainDirname) {
  return validateProductionBundle({
    indexPath: path.join(mainDirname, '..', 'dist', 'index.html')
  });
}

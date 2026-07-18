import fs from 'fs';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the obfuscation configuration.
const configPath = path.join(__dirname, '../obfuscator.config.js');
let config = {};

try {
  const configModule = await import(pathToFileURL(configPath).href);
  config = configModule.default || configModule;
  console.log('✅ Obfuscation configuration loaded.');
} catch (error) {
  console.warn('⚠️  Could not load the obfuscation configuration; using defaults:', error.message);
}

// Directories to obfuscate
const distDir = path.join(__dirname, '../dist');
const electronSourceDir = path.join(__dirname, '../electron');
const electronDir = path.join(__dirname, '../build/electron');

// Find JavaScript files.
async function findJsFiles(dir) {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(entry => {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return ['node_modules', 'test', 'tests', 'spec'].includes(entry.name)
            ? []
            : findJsFiles(filePath);
        }
        return /\.(?:js|cjs)$/.test(entry.name) &&
          !entry.name.endsWith('.min.js') &&
          !/\.(?:spec|test)\.js$/.test(entry.name)
          ? [filePath]
          : [];
      })
    );
    return nested.flat();
  } catch (error) {
    console.error(`Could not scan ${dir}:`, error);
    return [];
  }
}

// Obfuscate one file.
function obfuscateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Skip files that already contain the obfuscation marker.
    if (content.includes('JavaScript Obfuscator') || content.includes('obfuscated')) {
      console.log(`⏭️  Already obfuscated: ${path.relative(process.cwd(), filePath)}`);
      return 'skipped';
    }

    // Skip empty or very small files.
    if (content.length < 100) {
      console.log(
        `⏭️  File is too small: ${path.relative(process.cwd(), filePath)} (${content.length} bytes)`
      );
      return 'skipped';
    }

    // Apply obfuscation.
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(content, config);

    // Read the obfuscated output.
    const obfuscatedContent = obfuscatedCode.getObfuscatedCode();

    // Write the transformed file.
    fs.writeFileSync(filePath, obfuscatedContent, 'utf8');

    // Write a source map when enabled.
    if (config.sourceMap && config.sourceMapMode === 'separate') {
      const sourceMap = obfuscatedCode.getSourceMap();
      const sourceMapPath = filePath + '.map';
      fs.writeFileSync(sourceMapPath, sourceMap, 'utf8');
    }

    console.log(
      `✅ Obfuscated: ${path.relative(process.cwd(), filePath)} (${content.length} → ${obfuscatedContent.length} bytes)`
    );
    return 'obfuscated';
  } catch (error) {
    console.error(`❌ Could not obfuscate ${filePath}:`, error.message);
    return 'failed';
  }
}

// Main entry point
async function main() {
  console.log('🚀 Starting code obfuscation...');

  // Confirm that the build output exists.
  if (!fs.existsSync(distDir)) {
    console.error(`❌ The dist directory does not exist: ${distDir}`);
    console.log('💡 Run npm run build first.');
    process.exit(1);
  }

  // Electron source files are copied before obfuscation so a package build never mutates the repo.
  fs.rmSync(electronDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(electronDir), { recursive: true });
  fs.cpSync(electronSourceDir, electronDir, { recursive: true });

  // Find every JavaScript file.
  const electronFiles = await findJsFiles(electronDir);
  // Vite already minifies and code-splits renderer chunks. Re-obfuscating them doubles their
  // size and can break native ESM boundaries, so only the staged Electron main-process code is
  // obfuscated here.
  const allFiles = electronFiles;

  if (allFiles.length === 0) {
    console.log('⚠️  No JavaScript files found.');
    return;
  }

  console.log(`📁 Found ${allFiles.length} JavaScript files.`);

  // Obfuscate each file.
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of allFiles) {
    const result = obfuscateFile(file);
    if (result === 'obfuscated') {
      successCount++;
    } else if (result === 'skipped') {
      skipCount++;
    } else {
      errorCount++;
    }
  }

  for (const file of allFiles) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (check.status !== 0) {
      errorCount++;
      console.error(`❌ Syntax check failed for ${file}:`, check.stderr.trim());
    }
  }

  // Print the summary.
  console.log('\n📊 Obfuscation summary:');
  console.log(`✅ Succeeded: ${successCount} files`);
  console.log(`⏭️  Skipped: ${skipCount} files`);
  console.log(`❌ Failed: ${errorCount} files`);
  console.log(`📁 Total: ${allFiles.length} files`);

  // Create the obfuscation marker.
  const markerFile = path.join(distDir, '.obfuscated');
  fs.writeFileSync(markerFile, `Completed: ${new Date().toISOString()}\nFiles: ${successCount}`);
  console.log(`\n🏷️  Created obfuscation marker: ${markerFile}`);

  if (errorCount > 0) {
    console.warn('\n⚠️  Some files could not be obfuscated. Review the errors above.');
    process.exit(1);
  }

  console.log('\n🎉 Code obfuscation complete.');
}

// Run the script.
main().catch(error => {
  console.error('❌ Obfuscation failed:', error);
  process.exit(1);
});

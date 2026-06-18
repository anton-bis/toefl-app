import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import obfuscatorPkg from 'javascript-obfuscator';
import { fileURLToPath } from 'url';

const { JavaScriptObfuscator } = obfuscatorPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载配置
const configPath = path.join(__dirname, '../obfuscator.config.js');
let config = {};

try {
  const configModule = await import(configPath);
  config = configModule.default || configModule;
  console.log('✅ 加载混淆配置成功');
} catch (error) {
  console.warn('⚠️  无法加载混淆配置，使用默认配置:', error.message);
}

// 要混淆的目录
const distDir = path.join(__dirname, '../dist');
const electronDir = path.join(__dirname, '../electron');

// 查找JavaScript文件
async function findJsFiles(dir) {
  try {
    const pattern = path.join(dir, '**/*.js');
    const files = await glob(pattern, {
      ignore: [
        '**/node_modules/**',
        '**/*.map',
        '**/*.min.js',
        '**/test/**',
        '**/tests/**',
        '**/spec/**',
        '**/*.spec.js',
        '**/*.test.js'
      ]
    });
    return files;
  } catch (error) {
    console.error(`查找文件失败 ${dir}:`, error);
    return [];
  }
}

// 混淆单个文件
function obfuscateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // 跳过已经混淆的文件（包含特定的混淆标记）
    if (content.includes('JavaScript Obfuscator') || content.includes('obfuscated')) {
      console.log(`⏭️  跳过已混淆文件: ${path.relative(process.cwd(), filePath)}`);
      return false;
    }

    // 跳过空文件或非常小的文件
    if (content.length < 100) {
      console.log(
        `⏭️  跳过小文件: ${path.relative(process.cwd(), filePath)} (${content.length} 字节)`
      );
      return false;
    }

    // 应用混淆
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(content, config);

    // 获取混淆后的代码
    const obfuscatedContent = obfuscatedCode.getObfuscatedCode();

    // 写入文件
    fs.writeFileSync(filePath, obfuscatedContent, 'utf8');

    // 获取源映射（如果启用）
    if (config.sourceMap && config.sourceMapMode === 'separate') {
      const sourceMap = obfuscatedCode.getSourceMap();
      const sourceMapPath = filePath + '.map';
      fs.writeFileSync(sourceMapPath, sourceMap, 'utf8');
    }

    console.log(
      `✅ 混淆完成: ${path.relative(process.cwd(), filePath)} (${content.length} → ${obfuscatedContent.length} 字节)`
    );
    return true;
  } catch (error) {
    console.error(`❌ 混淆失败 ${filePath}:`, error.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始代码混淆...');

  // 检查目录是否存在
  if (!fs.existsSync(distDir)) {
    console.error(`❌ dist目录不存在: ${distDir}`);
    console.log('💡 提示: 请先运行 npm run build 或 npm run electron:build-only');
    process.exit(1);
  }

  // 查找所有JavaScript文件
  const distFiles = await findJsFiles(distDir);
  const electronFiles = await findJsFiles(electronDir);
  const allFiles = [...distFiles, ...electronFiles];

  if (allFiles.length === 0) {
    console.log('⚠️  未找到JavaScript文件');
    return;
  }

  console.log(`📁 找到 ${allFiles.length} 个JavaScript文件`);

  // 混淆文件
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of allFiles) {
    const result = obfuscateFile(file);
    if (result === true) {
      successCount++;
    } else if (result === false) {
      skipCount++;
    } else {
      errorCount++;
    }
  }

  // 输出统计
  console.log('\n📊 混淆统计:');
  console.log(`✅ 成功: ${successCount} 个文件`);
  console.log(`⏭️  跳过: ${skipCount} 个文件`);
  console.log(`❌ 失败: ${errorCount} 个文件`);
  console.log(`📁 总计: ${allFiles.length} 个文件`);

  // 创建混淆标记文件
  const markerFile = path.join(distDir, '.obfuscated');
  fs.writeFileSync(markerFile, `混淆完成: ${new Date().toISOString()}\n文件数: ${successCount}`);
  console.log(`\n🏷️  混淆标记文件已创建: ${markerFile}`);

  if (errorCount > 0) {
    console.warn('\n⚠️  部分文件混淆失败，请检查错误信息');
    process.exit(1);
  }

  console.log('\n🎉 代码混淆完成！');
}

// 运行主函数
main().catch(error => {
  console.error('❌ 混淆过程出错:', error);
  process.exit(1);
});

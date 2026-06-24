/**
 * 核心加载器 - 统一资源加载
 * 支持Markdown、音频、文本文件加载
 */

class ResourceLoader {
  constructor() {
    this.cache = new Map();
    this.basePath = 'assets/questions/';
    this._externalFiles = null;
  }

  setExternalFiles(fileMap) {
    this._externalFiles = fileMap;
  }

  /**
   * 统一加载资源
   * @param {string} path - 资源路径
   * @param {string} type - 资源类型: 'markdown' | 'audio' | 'text'
   * @returns {Promise<any>} 加载的资源
   */
  async load(path, type = 'markdown') {
    const cacheKey = `${type}:${path}`;

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      console.log(`从缓存加载: ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    try {
      let resource;
      let fullPath = `${this.basePath}${path}`;
      if (window.location.protocol === 'file:' && typeof window.electronAPI !== 'undefined') {
        fullPath = '../' + fullPath;
      }

      switch (type) {
        case 'markdown':
          resource = await this.loadMarkdown(fullPath);
          break;
        case 'audio':
          resource = await this.loadAudio(fullPath);
          break;
        case 'text':
          resource = await this.loadText(fullPath);
          break;
        default:
          throw new Error(`不支持的资源类型: ${type}`);
      }

      // 存入缓存
      this.cache.set(cacheKey, resource);
      console.log(`加载成功: ${cacheKey}`);
      return resource;
    } catch (error) {
      console.error(`加载失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 加载Markdown文件
   */
  async loadMarkdown(path) {
    const useXHR = window.location.protocol === 'file:';
    const isElectron = typeof window.electronAPI !== 'undefined';

    // Electron 主进程提供的内容目录文件
    if (isElectron && this._externalFiles && this._externalFiles.has(path)) {
      const contentPath = await window.electronAPI.getContentPath(path);
      return this.loadWithXHR(contentPath);
    }

    if (useXHR) {
      console.log(`检测到file://协议，使用XMLHttpRequest加载: ${path}`);
      return this.loadWithXHR(path);
    }

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Markdown加载失败: ${response.status}`);
    }
    return await response.text();
  }

  /**
   * 使用XMLHttpRequest加载本地文件（file://协议兼容）
   */
  async loadWithXHR(path) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', path, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 0 || xhr.status === 200) {
            // file://协议下status可能是0
            resolve(xhr.responseText);
          } else {
            reject(new Error(`XMLHttpRequest加载失败: ${xhr.status} ${path}`));
          }
        }
      };
      xhr.onerror = function () {
        reject(new Error(`XMLHttpRequest网络错误: ${path}`));
      };
      xhr.send();
    });
  }

  /**
   * 加载音频文件
   */
  async loadAudio(path) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'auto';

      audio.oncanplaythrough = () => {
        console.log(`音频加载完成: ${path}`);
        resolve(audio);
      };

      audio.onerror = error => {
        console.error(`音频加载失败: ${path}`, error);
        reject(new Error(`音频加载失败: ${path}`));
      };

      audio.src = path;
    });
  }

  /**
   * 加载文本文件
   */
  async loadText(path) {
    // 检查是否在本地文件协议下
    if (window.location.protocol === 'file:') {
      console.log(`检测到file://协议，使用XMLHttpRequest加载文本: ${path}`);
      return this.loadWithXHR(path);
    }

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`文本加载失败: ${response.status}`);
    }
    return await response.text();
  }

  /**
   * 扫描题库目录
   * @param {string} moduleName - 模块名称: 'reading' | 'listening' | 'writing' | 'speaking'
   * @returns {Promise<string[]>} 题库文件列表
   */
  async scanQuestionBank(moduleName) {
    // 在实际项目中，这里应该扫描服务器目录
    // 目前我们返回预设的文件列表
    const questionFiles = {
      reading: [
        'reading/TPO-01/reading-TPO-01.md',
        'reading/TPO-02/reading-TPO-02.md',
        'reading/TPO-03/reading-TPO-03.md'
      ],
      listening: ['listening/TPO-01/listening-TPO-01.md', 'listening/TPO-03/listening-TPO-03.md'],
      writing: ['writing/TPO-01/writing-TPO-01.md'],
      speaking: ['speaking/TPO-01/speaking-TPO-01.md', 'speaking/TPO-03/speaking-TPO-03.md']
    };

    const baseFiles = questionFiles[moduleName] || [];

    // 合并内容更新目录的文件
    if (this._externalFiles && this._externalFiles[moduleName]) {
      const seen = new Set(baseFiles);
      for (const f of this._externalFiles[moduleName]) {
        if (!seen.has(f)) {
          baseFiles.push(f);
          seen.add(f);
        }
      }
    }

    return baseFiles;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('缓存已清除');
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 导出单例实例
export const loader = new ResourceLoader();

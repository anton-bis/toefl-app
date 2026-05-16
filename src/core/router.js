class HashRouter {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.defaultRoute = '/';
    this.beforeRouteChange = null;
    this.afterRouteChange = null;
    this._initialized = false;
  }

  register(path, handler) {
    this.routes.set(path, handler);
    console.log(`路由注册: ${path}`);
  }

  init(options = {}) {
    if (this._initialized) {
      console.warn('路由器已初始化');
      return;
    }

    if (options.defaultRoute) {
      this.defaultRoute = options.defaultRoute;
    }
    this.beforeRouteChange = options.beforeRouteChange || null;
    this.afterRouteChange = options.afterRouteChange || null;

    window.addEventListener('hashchange', () => this._handleRouteChange());
    this._handleRouteChange();

    this._initialized = true;
    console.log('Hash 路由器初始化完成');
  }

  navigate(path) {
    if (location.hash !== `#${path}`) {
      location.hash = path;
    } else {
      this._handleRouteChange();
    }
  }

  getCurrentRoute() {
    const hash = location.hash.slice(1) || this.defaultRoute;
    return hash || this.defaultRoute;
  }

  async _handleRouteChange() {
    const newRoute = this.getCurrentRoute();
    console.log(`路由变化: ${this.currentRoute} -> ${newRoute}`);

    if (this.beforeRouteChange) {
      const shouldContinue = await this.beforeRouteChange(this.currentRoute, newRoute);
      if (shouldContinue === false) {
        console.log('路由切换被取消');
        if (this.currentRoute) {
          location.hash = this.currentRoute;
        }
        return;
      }
    }

    const handler = this.routes.get(newRoute);
    if (handler) {
      try {
        await handler();
        this.currentRoute = newRoute;
        console.log(`路由加载成功: ${newRoute}`);
      } catch (error) {
        console.error(`路由加载失败: ${newRoute}`, error);
      }
    } else {
      console.warn(`未找到路由: ${newRoute}，使用默认路由`);
      this.navigate(this.defaultRoute);
      return;
    }

    if (this.afterRouteChange) {
      await this.afterRouteChange(this.currentRoute, newRoute);
    }
  }

  destroy() {
    window.removeEventListener('hashchange', this._handleRouteChange);
    this.routes.clear();
    this.currentRoute = null;
    this._initialized = false;
    console.log('路由器已销毁');
  }
}

export const router = new HashRouter();

/**
 * Web 端引导配置。
 *
 * 首页顶部「前往网页版」横幅的跳转目标与开关。
 * - WEB_BASE_URL：Web 端正式域名（备案中，上线后生效）。
 * - WEB_BASE_DISPLAY：横幅文案中展示的域名（去掉协议更简洁）。
 * - PROMO_JUMP_ENABLED：justtofu.com 完成备案并上线后改为 true，横幅才可点击跳转；
 *   当前为 false，横幅仅作信息展示，避免点击后打不开。
 */
export const WEB_BASE_URL = 'https://www.justtofu.com';
export const WEB_BASE_DISPLAY = 'www.justtofu.com';
export const PROMO_JUMP_ENABLED = false;

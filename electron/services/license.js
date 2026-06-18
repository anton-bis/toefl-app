import crypto from 'crypto';
import os from 'os';
import { app } from 'electron';
import { getDatabase } from './database.js';
import { settingsService } from './database.js';

// 许可证类型
export const LicenseType = {
  TRIAL: 'trial',
  PERPETUAL: 'perpetual',
  SUBSCRIPTION: 'subscription'
};

// 许可证状态
export const LicenseStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  INVALID: 'invalid'
};

// 阶段控制：true=测试版(无限试用) false=正式版(启用付费)
const DEV_MODE = true;

// 试用期天数（正式版使用）
const TRIAL_DAYS = DEV_MODE ? 99999 : 14;

// 生成设备指纹
export function generateDeviceFingerprint() {
  const hardwareInfo = {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    macAddress: getMacAddress(),
    appVersion: app.getVersion()
  };

  const fingerprintString = JSON.stringify(hardwareInfo);
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

// 获取MAC地址（简化版）
function getMacAddress() {
  try {
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name]) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          return net.mac;
        }
      }
    }
  } catch (error) {
    console.warn('获取MAC地址失败:', error);
  }
  return 'unknown';
}

// 检查许可证状态
export async function checkLicense() {
  try {
    const db = getDatabase();

    // 获取设备指纹
    const deviceFingerprint = generateDeviceFingerprint();

    // 查找用户
    const getUser = db.prepare('SELECT * FROM users WHERE device_id = ?');
    const user = getUser.get(deviceFingerprint);

    if (!user) {
      // 创建新用户（试用用户）
      const createUser = db.prepare('INSERT INTO users (device_id) VALUES (?)');
      const result = createUser.run(deviceFingerprint);

      // 创建试用许可证
      const trialLicense = {
        license_key: `TRIAL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        license_type: LicenseType.TRIAL,
        status: LicenseStatus.ACTIVE,
        user_id: result.lastInsertRowid,
        activation_date: new Date().toISOString(),
        expiration_date: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      };

      const insertLicense = db.prepare(`
        INSERT INTO licenses 
        (license_key, license_type, status, user_id, activation_date, expiration_date) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertLicense.run(
        trialLicense.license_key,
        trialLicense.license_type,
        trialLicense.status,
        trialLicense.user_id,
        trialLicense.activation_date,
        trialLicense.expiration_date
      );

      return {
        valid: true,
        type: LicenseType.TRIAL,
        status: LicenseStatus.ACTIVE,
        message: `试用许可证已激活，剩余 ${TRIAL_DAYS} 天`,
        expiration_date: trialLicense.expiration_date,
        days_remaining: TRIAL_DAYS,
        is_trial: true
      };
    }

    // 查找用户的有效许可证
    const getLicense = db.prepare(`
      SELECT * FROM licenses 
      WHERE user_id = ? AND status = ? 
      ORDER BY expiration_date DESC 
      LIMIT 1
    `);

    const license = getLicense.get(user.id, LicenseStatus.ACTIVE);

    if (!license) {
      // 没有有效许可证
      return {
        valid: false,
        type: null,
        status: LicenseStatus.INVALID,
        message: '未找到有效许可证',
        is_trial: false
      };
    }

    // 检查许可证是否过期
    const now = new Date();
    const expirationDate = new Date(license.expiration_date);

    if (!DEV_MODE && expirationDate < now && license.license_type !== LicenseType.PERPETUAL) {
      // 许可证已过期
      const updateLicense = db.prepare(`
        UPDATE licenses SET status = ? WHERE id = ?
      `);
      updateLicense.run(LicenseStatus.EXPIRED, license.id);

      return {
        valid: false,
        type: license.license_type,
        status: LicenseStatus.EXPIRED,
        message: '许可证已过期',
        expiration_date: license.expiration_date,
        is_trial: license.license_type === LicenseType.TRIAL
      };
    }

    // 计算剩余天数
    let daysRemaining = null;
    if (license.license_type !== LicenseType.PERPETUAL) {
      daysRemaining = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
    }

    // 更新用户最后登录时间
    const updateUser = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    updateUser.run(user.id);

    return {
      valid: true,
      type: license.license_type,
      status: LicenseStatus.ACTIVE,
      message:
        license.license_type === LicenseType.PERPETUAL
          ? '永久许可证有效'
          : `许可证有效，剩余 ${daysRemaining} 天`,
      expiration_date: license.expiration_date,
      days_remaining: daysRemaining,
      is_trial: license.license_type === LicenseType.TRIAL,
      license_key: license.license_key
    };
  } catch (error) {
    console.error('检查许可证失败:', error);
    return {
      valid: false,
      type: null,
      status: LicenseStatus.INVALID,
      message: '许可证检查失败',
      error: error.message,
      is_trial: false
    };
  }
}

// 激活许可证
export async function activateLicense(licenseKey) {
  try {
    const db = getDatabase();

    // 验证许可证密钥格式
    if (!licenseKey || typeof licenseKey !== 'string' || licenseKey.trim().length < 10) {
      return {
        success: false,
        message: '无效的许可证密钥格式'
      };
    }

    // 获取设备指纹
    const deviceFingerprint = generateDeviceFingerprint();

    // 查找用户
    const getUser = db.prepare('SELECT * FROM users WHERE device_id = ?');
    const user = getUser.get(deviceFingerprint);

    if (!user) {
      return {
        success: false,
        message: '用户未找到，请先启动试用版'
      };
    }

    // 检查许可证密钥（简化版 - 实际应连接许可证服务器）
    const licenseInfo = validateLicenseKey(licenseKey);

    if (!licenseInfo.valid) {
      return {
        success: false,
        message: licenseInfo.message || '无效的许可证密钥'
      };
    }

    // 停用用户现有的有效许可证
    const deactivateLicenses = db.prepare(`
      UPDATE licenses SET status = ? 
      WHERE user_id = ? AND status = ?
    `);
    deactivateLicenses.run(LicenseStatus.REVOKED, user.id, LicenseStatus.ACTIVE);

    // 创建新许可证记录
    const now = new Date();
    let expirationDate = null;

    if (licenseInfo.type === LicenseType.PERPETUAL) {
      expirationDate = new Date(9999, 11, 31).toISOString(); // 永久
    } else if (licenseInfo.type === LicenseType.SUBSCRIPTION) {
      expirationDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1年
    } else {
      expirationDate = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    }

    const insertLicense = db.prepare(`
      INSERT INTO licenses 
      (license_key, license_type, status, user_id, activation_date, expiration_date) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = insertLicense.run(
      licenseKey,
      licenseInfo.type,
      LicenseStatus.ACTIVE,
      user.id,
      now.toISOString(),
      expirationDate
    );

    // 保存许可证密钥到设置
    settingsService.setSetting('last_activated_license', licenseKey, 'license');
    settingsService.setSetting('license_activation_date', now.toISOString(), 'license');

    return {
      success: true,
      message: `许可证激活成功！类型：${licenseInfo.type === LicenseType.PERPETUAL ? '永久' : '订阅'}`,
      license_type: licenseInfo.type,
      expiration_date: expirationDate,
      license_id: result.lastInsertRowid
    };
  } catch (error) {
    console.error('激活许可证失败:', error);
    return {
      success: false,
      message: '许可证激活失败',
      error: error.message
    };
  }
}

// 验证许可证密钥（简化版 - 实际应连接服务器）
function validateLicenseKey(licenseKey) {
  // 简单格式验证
  const patterns = {
    perpetual: /^PERP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i,
    subscription: /^SUB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i,
    trial: /^TRIAL-[A-Z0-9]{4}-[A-Z0-9]{4}$/i
  };

  // 检查匹配的模式
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(licenseKey)) {
      return {
        valid: true,
        type:
          type === 'perpetual'
            ? LicenseType.PERPETUAL
            : type === 'subscription'
              ? LicenseType.SUBSCRIPTION
              : LicenseType.TRIAL,
        message: '许可证密钥格式有效'
      };
    }
  }

  // 如果不是标准格式，检查是否为试用密钥
  if (licenseKey.startsWith('TRIAL-')) {
    return {
      valid: true,
      type: LicenseType.TRIAL,
      message: '试用许可证密钥'
    };
  }

  return {
    valid: false,
    message: '无效的许可证密钥格式'
  };
}

// 获取许可证信息
export async function getLicenseInfo() {
  const licenseStatus = await checkLicense();

  // 添加额外的试用信息
  if (licenseStatus.is_trial && licenseStatus.days_remaining !== null) {
    licenseStatus.trial_info = {
      total_days: TRIAL_DAYS,
      used_days: TRIAL_DAYS - licenseStatus.days_remaining,
      percentage_used: ((TRIAL_DAYS - licenseStatus.days_remaining) / TRIAL_DAYS) * 100
    };
  }

  return licenseStatus;
}

// 重置试用许可证（仅用于测试）
export async function resetTrialLicense() {
  try {
    const db = getDatabase();
    const deviceFingerprint = generateDeviceFingerprint();

    // 删除用户及其所有许可证
    const deleteUser = db.prepare('DELETE FROM users WHERE device_id = ?');
    deleteUser.run(deviceFingerprint);

    // 清除许可证设置
    settingsService.deleteSetting('last_activated_license');
    settingsService.deleteSetting('license_activation_date');

    return {
      success: true,
      message: '试用许可证已重置'
    };
  } catch (error) {
    console.error('重置试用许可证失败:', error);
    return {
      success: false,
      message: '重置失败',
      error: error.message
    };
  }
}

// 检查是否需要显示许可证提醒
export function shouldShowLicenseReminder(_licenseStatus) {
  if (DEV_MODE) return false;
  if (!_licenseStatus.valid) return true;
  if (_licenseStatus.is_trial && _licenseStatus.days_remaining !== null) {
    if (_licenseStatus.days_remaining <= 3) return true;
    if (_licenseStatus.days_remaining <= TRIAL_DAYS / 2) return true;
  }
  return false;
}

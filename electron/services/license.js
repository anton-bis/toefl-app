import crypto from 'crypto';
import os from 'os';
import { app } from 'electron';
import { getDatabase, settingsService } from './database.js';

// License types
export const LicenseType = {
  TRIAL: 'trial',
  PERPETUAL: 'perpetual',
  SUBSCRIPTION: 'subscription'
};

// License states
export const LicenseStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  INVALID: 'invalid'
};

// Keep enforcement disabled until server signatures and public-key verification are implemented.
const LICENSE_ENFORCEMENT_ENABLED = false;
const TRIAL_DAYS = 14;

// Generate a device fingerprint.
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

// Find the first usable MAC address.
function getMacAddress() {
  try {
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name] || []) {
        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
          return net.mac;
        }
      }
    }
  } catch (error) {
    console.warn('Could not read a MAC address:', error);
  }
  return 'unknown';
}

// Check license status.
export async function checkLicense() {
  if (!LICENSE_ENFORCEMENT_ENABLED) {
    return {
      valid: true,
      type: LicenseType.PERPETUAL,
      status: LicenseStatus.ACTIVE,
      message: 'Licensing is not enabled.',
      is_trial: false
    };
  }
  try {
    const db = getDatabase();

    // Identify this device.
    const deviceFingerprint = generateDeviceFingerprint();

    // Find the local user.
    const getUser = db.prepare('SELECT * FROM users WHERE device_id = ?');
    const user = getUser.get(deviceFingerprint);

    if (!user) {
      // Create a trial user.
      const createUser = db.prepare('INSERT INTO users (device_id) VALUES (?)');
      const result = createUser.run(deviceFingerprint);

      // Create a trial license.
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
        message: `Your trial is active for ${TRIAL_DAYS} more days.`,
        expiration_date: trialLicense.expiration_date,
        days_remaining: TRIAL_DAYS,
        is_trial: true
      };
    }

    // Find the user's active license.
    const getLicense = db.prepare(`
      SELECT * FROM licenses 
      WHERE user_id = ? AND status = ? 
      ORDER BY expiration_date DESC 
      LIMIT 1
    `);

    const license = getLicense.get(user.id, LicenseStatus.ACTIVE);

    if (!license) {
      // No active license was found.
      return {
        valid: false,
        type: null,
        status: LicenseStatus.INVALID,
        message: 'No active license was found.',
        is_trial: false
      };
    }

    // Check for expiration.
    const now = new Date();
    const expirationDate = new Date(license.expiration_date);

    if (
      LICENSE_ENFORCEMENT_ENABLED &&
      expirationDate < now &&
      license.license_type !== LicenseType.PERPETUAL
    ) {
      // Mark an expired license.
      const updateLicense = db.prepare(`
        UPDATE licenses SET status = ? WHERE id = ?
      `);
      updateLicense.run(LicenseStatus.EXPIRED, license.id);

      return {
        valid: false,
        type: license.license_type,
        status: LicenseStatus.EXPIRED,
        message: 'Your license has expired.',
        expiration_date: license.expiration_date,
        is_trial: license.license_type === LicenseType.TRIAL
      };
    }

    // Calculate the remaining days.
    let daysRemaining = null;
    if (license.license_type !== LicenseType.PERPETUAL) {
      daysRemaining = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
    }

    // Record the latest sign-in.
    const updateUser = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    updateUser.run(user.id);

    return {
      valid: true,
      type: license.license_type,
      status: LicenseStatus.ACTIVE,
      message:
        license.license_type === LicenseType.PERPETUAL
          ? 'Your lifetime license is active.'
          : `Your license is active for ${daysRemaining} more days.`,
      expiration_date: license.expiration_date,
      days_remaining: daysRemaining,
      is_trial: license.license_type === LicenseType.TRIAL,
      license_key: license.license_key
    };
  } catch (error) {
    console.error('License check failed:', error);
    return {
      valid: false,
      type: null,
      status: LicenseStatus.INVALID,
      message: 'Could not verify the license.',
      error: error.message,
      is_trial: false
    };
  }
}

// Activate a license.
export async function activateLicense(licenseKey) {
  if (!LICENSE_ENFORCEMENT_ENABLED) {
    return { success: false, message: 'Licensing is not enabled.' };
  }
  try {
    const db = getDatabase();

    // Validate the license key format.
    if (!licenseKey || typeof licenseKey !== 'string' || licenseKey.trim().length < 10) {
      return {
        success: false,
        message: 'Enter a valid license key.'
      };
    }

    // Identify this device.
    const deviceFingerprint = generateDeviceFingerprint();

    // Find the local user.
    const getUser = db.prepare('SELECT * FROM users WHERE device_id = ?');
    const user = getUser.get(deviceFingerprint);

    if (!user) {
      return {
        success: false,
        message: 'No local user was found. Start the trial first.'
      };
    }

    // Validate the key locally until a license server is available.
    const licenseInfo = validateLicenseKey(licenseKey);

    if (!licenseInfo.valid) {
      return {
        success: false,
        message: licenseInfo.message || 'This license key is not valid.'
      };
    }

    // Deactivate existing licenses.
    const deactivateLicenses = db.prepare(`
      UPDATE licenses SET status = ? 
      WHERE user_id = ? AND status = ?
    `);
    deactivateLicenses.run(LicenseStatus.REVOKED, user.id, LicenseStatus.ACTIVE);

    // Create the new license record.
    const now = new Date();
    let expirationDate = null;

    if (licenseInfo.type === LicenseType.PERPETUAL) {
      expirationDate = new Date(9999, 11, 31).toISOString(); // Lifetime
    } else if (licenseInfo.type === LicenseType.SUBSCRIPTION) {
      expirationDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // One year
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

    // Store license metadata in settings.
    settingsService.setSetting('last_activated_license', licenseKey, 'license');
    settingsService.setSetting('license_activation_date', now.toISOString(), 'license');

    return {
      success: true,
      message: `License activated: ${licenseInfo.type === LicenseType.PERPETUAL ? 'lifetime' : 'subscription'}.`,
      license_type: licenseInfo.type,
      expiration_date: expirationDate,
      license_id: result.lastInsertRowid
    };
  } catch (error) {
    console.error('License activation failed:', error);
    return {
      success: false,
      message: 'Could not activate the license.',
      error: error.message
    };
  }
}

// Validate a license key locally until a license server is available.
function validateLicenseKey(licenseKey) {
  // Supported key formats
  const patterns = {
    perpetual: /^PERP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i,
    subscription: /^SUB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i,
    trial: /^TRIAL-[A-Z0-9]{4}-[A-Z0-9]{4}$/i
  };

  // Find the matching format.
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
        message: 'The license key format is valid.'
      };
    }
  }

  // Accept generated trial keys.
  if (licenseKey.startsWith('TRIAL-')) {
    return {
      valid: true,
      type: LicenseType.TRIAL,
      message: 'Trial license key.'
    };
  }

  return {
    valid: false,
    message: 'The license key format is not valid.'
  };
}

// Get license details.
export async function getLicenseInfo() {
  const licenseStatus = await checkLicense();

  // Add trial usage details.
  if (licenseStatus.is_trial && licenseStatus.days_remaining !== null) {
    licenseStatus.trial_info = {
      total_days: TRIAL_DAYS,
      used_days: TRIAL_DAYS - licenseStatus.days_remaining,
      percentage_used: ((TRIAL_DAYS - licenseStatus.days_remaining) / TRIAL_DAYS) * 100
    };
  }

  return licenseStatus;
}

// Reset the trial license in tests.
export async function resetTrialLicense() {
  if (!LICENSE_ENFORCEMENT_ENABLED) {
    return { success: false, message: 'Licensing is not enabled.' };
  }
  try {
    const db = getDatabase();
    const deviceFingerprint = generateDeviceFingerprint();

    // Delete the user and related licenses.
    const deleteUser = db.prepare('DELETE FROM users WHERE device_id = ?');
    deleteUser.run(deviceFingerprint);

    // Clear stored license settings.
    settingsService.deleteSetting('last_activated_license');
    settingsService.deleteSetting('license_activation_date');

    return {
      success: true,
      message: 'The trial license has been reset.'
    };
  } catch (error) {
    console.error('Could not reset the trial license:', error);
    return {
      success: false,
      message: 'Could not reset the trial license.',
      error: error.message
    };
  }
}

// Decide whether to show a license reminder.
export function shouldShowLicenseReminder(_licenseStatus) {
  if (!LICENSE_ENFORCEMENT_ENABLED) return false;
  if (!_licenseStatus.valid) return true;
  if (_licenseStatus.is_trial && _licenseStatus.days_remaining !== null) {
    if (_licenseStatus.days_remaining <= 3) return true;
    if (_licenseStatus.days_remaining <= TRIAL_DAYS / 2) return true;
  }
  return false;
}

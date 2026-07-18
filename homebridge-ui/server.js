'use strict';

const fs = require('node:fs');
const path = require('node:path');
void start();

async function start() {
  const { HomebridgePluginUiServer } = await import('@homebridge/plugin-ui-utils');

  class AwairUiServer extends HomebridgePluginUiServer {
    constructor() {
      super();
      this.onRequest('/discovered-devices', this.discoveredDevices.bind(this));
      this.ready();
    }

    discoveredDevices() {
      const directory = path.join(this.homebridgeStoragePath, 'accessories');
      if (!fs.existsSync(directory)) return [];

      const devices = [];
      for (const name of fs.readdirSync(directory)) {
        if (!name.startsWith('cachedAccessories') || name.endsWith('.bak')) continue;
        try {
          const records = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
          for (const accessory of Array.isArray(records) ? records : Object.values(records)) {
            const device = accessory?.context?.device;
            if (!isAwair(device)) continue;
            devices.push({
              ...device,
              displayName: accessory.displayName,
              uuid: accessory.UUID,
            });
          }
        } catch (_) {
          // A cache file can be rewritten while the UI is open; ignore that one read.
        }
      }
      return [...new Map(devices.map((device) => [identity(device), device])).values()];
    }
  }

  new AwairUiServer();
}

function isAwair(device) {
  return device && (device.manufacturer === 'Awair' || /^awair-/i.test(device.device_uuid || ''));
}

function identity(device) {
  return device.wifi_mac || device.device_uuid || device.serial || device.host || device.ip || device.uuid;
}

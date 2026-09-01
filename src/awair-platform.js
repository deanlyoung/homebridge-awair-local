'use strict';

const { AwairAccessory } = require('./awair-accessory');
const { MdnsDiscovery } = require('./mdns-discovery');
const { SubnetDiscovery } = require('./subnet-discovery');

const PLUGIN_NAME = 'homebridge-awair-local';
const PLATFORM_NAME = 'AwairLocal';

class AwairPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.accessories = new Map();
    this.handlers = new Map();

    api.on('didFinishLaunching', () => this.start());
    api.on('shutdown', () => this.shutdown());
  }

  configureAccessory(accessory) {
    this.accessories.set(accessory.UUID, accessory);
  }

  start() {
    const configuredDevices = [...(this.config.devices || [])];
    // Accept a single legacy-shaped device in the platform block as a gentle migration path.
    if (this.config.ip || this.config.host) configuredDevices.push(this.config);
    for (const device of configuredDevices) {
      if (!device.ip && !device.host) {
        this.log.warn('Ignoring a configured Awair without an ip or host.');
        continue;
      }
      this.upsertDeviceSafely(device, false);
    }

    if (this.config.discovery === true) {
      this.discovery = new MdnsDiscovery({
        log: this.log,
        serviceTypes: this.config.mdnsServiceTypes,
        hostnames: this.config.discoveryHostnames,
        onDevice: (device) => this.upsertDeviceSafely(device, true),
      });
      this.discovery.start();

      if (this.config.subnetDiscovery !== false) {
        this.subnetDiscovery = new SubnetDiscovery({
          log: this.log,
          maxHosts: this.config.subnetDiscoveryMaxHosts,
          onDevice: (device) => this.upsertDeviceSafely(device, true),
        });
        this.subnetDiscovery.start();
      }
    }
  }

  async upsertDeviceSafely(device, discovered) {
    try {
      await this.upsertDevice(device, discovered);
    } catch (error) {
      const endpoint = device.host || device.ip || 'unknown endpoint';
      this.log.warn(`Could not initialize Awair at ${endpoint}: ${error.message}`);
    }
  }

  async upsertDevice(device, discovered) {
    const normalized = await AwairAccessory.identify(device);
    // A configured endpoint or serial must keep the same HAP identity whether or not
    // the optional settings endpoint is reachable. Discovered devices already carry
    // their hardware identity, so they continue to prefer that value.
    const identity = deviceIdentity(device) || deviceIdentity(normalized);
    if (!identity) {
      this.log.warn('Skipping Awair with no stable device identity.');
      return;
    }

    const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${identity}`);
    const matchingAccessories = [...new Set(this.accessories.values())]
      .filter((candidate) => candidate.UUID === uuid || sameDevice(candidate.context?.device, normalized));
    let accessory = this.accessories.get(uuid) || matchingAccessories[0];
    const duplicates = matchingAccessories.filter((candidate) => candidate !== accessory);
    if (duplicates.length) {
      for (const duplicate of duplicates) {
        this.handlers.get(duplicate.UUID)?.shutdown();
        this.handlers.delete(duplicate.UUID);
      }
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, duplicates);
      for (const [key, candidate] of this.accessories) if (duplicates.includes(candidate)) this.accessories.delete(key);
      this.log.info(`Removed ${duplicates.length} duplicate cached Awair ${duplicates.length === 1 ? 'accessory' : 'accessories'}: ${identity}`);
    }
    const name = normalized.name || normalized.device_uuid || normalized.host || normalized.ip;

    if (!accessory) {
      accessory = new this.api.platformAccessory(name, uuid);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.log.info(`Added ${discovered ? 'discovered' : 'configured'} Awair: ${name}`);
    } else if (accessory.displayName !== name) {
      accessory.updateDisplayName(name);
    }

    if (!accessory.context) accessory.context = {};
    const contextDevice = accessory.context?.device || {};
    const aliases = [...new Set([
      ...(contextDevice.aliases || []), contextDevice.host, contextDevice.ip,
      normalized.host, normalized.ip,
    ].filter(Boolean))];
    for (const [key, candidate] of this.accessories) if (candidate === accessory) this.accessories.delete(key);
    const accessoryUuid = accessory.UUID || uuid;
    this.accessories.set(accessoryUuid, accessory);
    accessory.context.device = { ...(accessory.context.device || {}), ...normalized, aliases };
    this.api.updatePlatformAccessories([accessory]);

    this.handlers.get(accessoryUuid)?.shutdown();
    const handler = new AwairAccessory(this, accessory, accessory.context.device);
    this.handlers.set(accessoryUuid, handler);
    handler.start();
  }

  shutdown() {
    this.discovery?.stop();
    this.subnetDiscovery?.stop();
    for (const handler of this.handlers.values()) handler.shutdown();
    this.handlers.clear();
  }
}

function deviceIdentity(device = {}) {
  return String(device.device_uuid || device.wifi_mac || device.serial || device.host || device.ip || '').toLowerCase();
}

function sameDevice(first = {}, second = {}) {
  const firstHardware = identifiers(first, ['device_uuid', 'wifi_mac']);
  const secondHardware = identifiers(second, ['device_uuid', 'wifi_mac']);
  if (intersects(firstHardware, secondHardware)) return true;

  // Do not merge two known devices merely because DHCP reused an address.
  for (const field of ['device_uuid', 'wifi_mac']) {
    const firstValue = identifier(first[field]);
    const secondValue = identifier(second[field]);
    if (firstValue && secondValue && firstValue !== secondValue) return false;
  }
  return intersects(identifiers(first), identifiers(second));
}

function identifiers(device, fields = ['device_uuid', 'wifi_mac', 'serial', 'host', 'ip', 'aliases']) {
  const values = fields.flatMap((field) => field === 'aliases' ? device.aliases || [] : [device[field]]);
  return new Set(values.map(identifier).filter(Boolean));
}

function intersects(first, second) {
  return [...first].some((value) => second.has(value));
}

function identifier(value) {
  return value ? String(value).toLowerCase() : '';
}

module.exports = { AwairPlatform, PLUGIN_NAME, PLATFORM_NAME };

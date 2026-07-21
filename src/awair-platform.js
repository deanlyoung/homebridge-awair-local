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
    const identity = deviceIdentity(normalized);
    if (!identity) {
      this.log.warn('Skipping Awair with no stable device identity.');
      return;
    }

    const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${identity}`);
    const matchingAccessories = [...this.accessories.values()].filter((candidate) => deviceIdentity(candidate.context.device) === identity);
    let accessory = this.accessories.get(uuid) || matchingAccessories[0];
    const duplicates = matchingAccessories.filter((candidate) => candidate !== accessory);
    if (duplicates.length) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, duplicates);
      for (const [key, candidate] of this.accessories) if (duplicates.includes(candidate)) this.accessories.delete(key);
    }
    const name = normalized.name || normalized.device_uuid || normalized.host || normalized.ip;

    if (!accessory) {
      accessory = new this.api.platformAccessory(name, uuid);
      this.accessories.set(uuid, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.log.info(`Added ${discovered ? 'discovered' : 'configured'} Awair: ${name}`);
    } else if (accessory.displayName !== name) {
      accessory.updateDisplayName(name);
    }

    const aliases = [...new Set([
      ...(accessory.context.device.aliases || []), accessory.context.device.host, accessory.context.device.ip,
      normalized.host, normalized.ip,
    ].filter(Boolean))];
    for (const [key, candidate] of this.accessories) if (candidate === accessory) this.accessories.delete(key);
    this.accessories.set(uuid, accessory);
    accessory.context.device = { ...accessory.context.device, ...normalized, aliases };
    this.api.updatePlatformAccessories([accessory]);

    this.handlers.get(uuid)?.shutdown();
    const handler = new AwairAccessory(this, accessory, accessory.context.device);
    this.handlers.set(uuid, handler);
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

module.exports = { AwairPlatform, PLUGIN_NAME, PLATFORM_NAME };

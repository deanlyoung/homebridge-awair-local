'use strict';

const { AwairAccessory } = require('./awair-accessory');
const { MdnsDiscovery } = require('./mdns-discovery');

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
      this.upsertDevice(device, false);
    }

    if (this.config.discovery !== false) {
      this.discovery = new MdnsDiscovery({
        log: this.log,
        serviceTypes: this.config.mdnsServiceTypes,
        hostnames: this.config.discoveryHostnames,
        onDevice: (device) => this.upsertDevice(device, true),
      });
      this.discovery.start();
    }
  }

  async upsertDevice(device, discovered) {
    const normalized = await AwairAccessory.identify(device);
    const identity = normalized.device_uuid || normalized.wifi_mac || normalized.host || normalized.ip;
    if (!identity) {
      this.log.warn('Skipping Awair with no stable device identity.');
      return;
    }

    const uuid = this.api.hap.uuid.generate(`${PLUGIN_NAME}:${identity}`);
    let accessory = this.accessories.get(uuid);
    const name = normalized.name || normalized.device_uuid || normalized.host || normalized.ip;

    if (!accessory) {
      accessory = new this.api.platformAccessory(name, uuid);
      this.accessories.set(uuid, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.log.info(`Added ${discovered ? 'discovered' : 'configured'} Awair: ${name}`);
    } else if (accessory.displayName !== name) {
      accessory.updateDisplayName(name);
    }

    accessory.context.device = { ...accessory.context.device, ...normalized };
    this.api.updatePlatformAccessories([accessory]);

    this.handlers.get(uuid)?.shutdown();
    const handler = new AwairAccessory(this, accessory, accessory.context.device);
    this.handlers.set(uuid, handler);
    handler.start();
  }

  shutdown() {
    this.discovery?.stop();
    for (const handler of this.handlers.values()) handler.shutdown();
    this.handlers.clear();
  }
}

module.exports = { AwairPlatform, PLUGIN_NAME, PLATFORM_NAME };

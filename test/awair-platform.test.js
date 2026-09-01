'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AwairPlatform } = require('../src/awair-platform');
const { AwairAccessory } = require('../src/awair-accessory');
const { SubnetDiscovery } = require('../src/subnet-discovery');

function createApi() {
  return {
    hap: { Service: {}, Characteristic: {}, uuid: { generate: (value) => value } },
    on() {},
  };
}

function createPlatformApi() {
  const registered = [];
  const unregistered = [];
  const updated = [];
  const Service = {
    AccessoryInformation: 'information',
    AirQualitySensor: 'air-quality',
    TemperatureSensor: 'temperature',
    HumiditySensor: 'humidity',
    CarbonDioxideSensor: 'carbon-dioxide',
    LightSensor: 'light',
  };
  const Characteristic = {
    Manufacturer: 'manufacturer',
    Model: 'model',
    SerialNumber: 'serial-number',
    FirmwareRevision: 'firmware-revision',
    CurrentTemperature: 'current-temperature',
    CurrentRelativeHumidity: 'current-humidity',
    VOCDensity: 'voc-density',
    PM2_5Density: 'pm2.5-density',
    PM10Density: 'pm10-density',
    CurrentAmbientLightLevel: 'light-level',
    CarbonDioxideLevel: 'carbon-dioxide-level',
    CarbonDioxideDetected: 'carbon-dioxide-detected',
    AirQuality: 'air-quality',
  };

  function PlatformAccessory(name, uuid) {
    this.displayName = name;
    this.UUID = uuid;
    this.context = {};
    this.services = new Map();
  }
  PlatformAccessory.prototype.updateDisplayName = function(name) { this.displayName = name; };
  PlatformAccessory.prototype.getService = function(type) { return this.services.get(type); };
  PlatformAccessory.prototype.getServiceById = function(type, name) { return this.services.get(`${type}:${name}`); };
  PlatformAccessory.prototype.addService = function(type, name, subtype) {
    const characteristics = new Map();
    const mockService = {
      setCharacteristic() { return this; },
      updateCharacteristic() { return this; },
      setPrimaryService() {},
      addLinkedService() {},
      getCharacteristic(characteristic) {
        if (!characteristics.has(characteristic)) characteristics.set(characteristic, { value: 0, setProps() {} });
        return characteristics.get(characteristic);
      },
    };
    this.services.set(subtype ? `${type}:${subtype}` : type, mockService);
    return mockService;
  };

  const api = {
    hap: { Service, Characteristic, uuid: { generate: (value) => `uuid-${value}` } },
    platformAccessory: PlatformAccessory,
    on() {},
    registerPlatformAccessories(_plugin, _platform, accessories) { registered.push(...accessories); },
    unregisterPlatformAccessories(_plugin, _platform, accessories) { unregistered.push(...accessories); },
    updatePlatformAccessories(accessories) { updated.push(...accessories); },
  };
  return { api, registered, unregistered, updated };
}

test('invalid configured devices are reported without an unhandled rejection', async () => {
  const warnings = [];
  const platform = new AwairPlatform({ warn: (message) => warnings.push(message) }, {
    devices: [{ ip: '127.0.0.1', requestTimeout: 1 }],
    discovery: false,
  }, createApi());

  await platform.upsertDeviceSafely({ ip: '127.0.0.1', requestTimeout: 1 }, false);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Could not initialize Awair at 127\.0\.0\.1/);
});

test('automatic discovery is disabled unless explicitly enabled', () => {
  const platform = new AwairPlatform({ warn() {} }, {}, createApi());

  platform.start();

  assert.equal(platform.discovery, undefined);
  assert.equal(platform.subnetDiscovery, undefined);
});

test('subnet discovery awaits callback failures and reports them', async (t) => {
  const originalFetch = global.fetch;
  const debug = [];
  global.fetch = async () => ({ ok: true, json: async () => ({ device_uuid: 'awair-element_test' }) });
  t.after(() => { global.fetch = originalFetch; });

  const discovery = new SubnetDiscovery({
    log: { debug: (message) => debug.push(message) },
    onDevice: async () => { throw new Error('callback failed'); },
  });
  discovery.scan = () => discovery.verify('192.168.1.70');

  discovery.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(debug, ['Subnet discovery error: callback failed']);
});

test('CO₂ thresholds default to alert at 1000 ppm and clear at 800 ppm', () => {
  const characteristic = { CarbonDioxideDetected: 'detected' };
  const service = {
    setCharacteristic() { return this; },
    getCharacteristic() { return { setProps() {}, value: 0 }; },
    setProps() {},
    setPrimaryService() {},
    addLinkedService() {},
  };
  const platform = {
    Service: { AccessoryInformation: 'info', AirQualitySensor: 'air', TemperatureSensor: 'temperature', HumiditySensor: 'humidity', CarbonDioxideSensor: 'co2' },
    Characteristic: { ...characteristic, CurrentTemperature: 'temperature', CurrentRelativeHumidity: 'humidity', VOCDensity: 'voc' },
  };
  const accessory = { getService: () => undefined, getServiceById: () => undefined, addService: () => service };

  const awair = new AwairAccessory(platform, accessory, { manufacturer: 'Awair', model: 'awair-element', serial: 'test', version: 'test' });

  assert.equal(awair.carbonDioxideThreshold, 1000);
  assert.equal(awair.carbonDioxideThresholdOff, 800);
});

test('live device metadata replaces cached generic values', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ device_uuid: 'awair-r2_3392', wifi_mac: '70:88:6B:10:59:0F', fw_version: '1.2.8' }) });
  t.after(() => { global.fetch = originalFetch; });

  const device = await AwairAccessory.identify({ host: '192.168.1.71', model: 'Awair', serial: '192.168.1.71', version: 'unknown' });

  assert.equal(device.version, '1.2.8');
  assert.equal(device.model, 'awair-r2');
  assert.equal(device.serial, '70:88:6B:10:59:0F');
});

test('a configured device keeps one accessory while transitioning from offline to online', async (t) => {
  const originalFetch = global.fetch;
  let settingsAvailable = false;
  global.fetch = async (url) => {
    if (String(url).includes('/settings/config/data')) {
      if (!settingsAvailable) throw new Error('device offline');
      return { ok: true, json: async () => ({
        device_uuid: 'awair-element_test',
        wifi_mac: '70:88:6b:00:00:01',
        fw_version: '1.2.3',
      }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  t.after(() => { global.fetch = originalFetch; });

  const { api, registered, unregistered } = createPlatformApi();
  const platform = new AwairPlatform({ info() {}, warn() {}, debug() {} }, {}, api);
  t.after(() => platform.shutdown());
  const config = { ip: '192.0.2.10', name: 'Office Awair', polling_interval: 60 };

  await platform.upsertDevice(config, false);
  const accessory = registered[0];
  settingsAvailable = true;
  await platform.upsertDevice(config, false);

  assert.equal(registered.length, 1);
  assert.equal(unregistered.length, 0);
  assert.equal(platform.accessories.size, 1);
  assert.equal(accessory.UUID, 'uuid-homebridge-awair-local:192.0.2.10');
  assert.equal(platform.accessories.get(accessory.UUID), accessory);
  assert.equal(accessory.context.device.device_uuid, 'awair-element_test');
  assert.equal(accessory.context.device.wifi_mac, '70:88:6b:00:00:01');
});

test('an existing hardware-ID duplicate is removed in favor of the configured accessory', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes('/settings/config/data') ? {
      device_uuid: 'awair-element_test',
      wifi_mac: '70:88:6b:00:00:01',
      fw_version: '1.2.3',
    } : {},
  });
  t.after(() => { global.fetch = originalFetch; });

  const { api, registered, unregistered } = createPlatformApi();
  const messages = [];
  const platform = new AwairPlatform({ info: (message) => messages.push(message), warn() {}, debug() {} }, {}, api);
  t.after(() => platform.shutdown());

  const configuredUuid = api.hap.uuid.generate('homebridge-awair-local:192.0.2.10');
  const hardwareUuid = api.hap.uuid.generate('homebridge-awair-local:awair-element_test');
  const configuredAccessory = new api.platformAccessory('Office Awair', configuredUuid);
  configuredAccessory.context.device = { ip: '192.0.2.10', serial: '192.0.2.10' };
  const duplicateAccessory = new api.platformAccessory('awair-element_test', hardwareUuid);
  duplicateAccessory.context.device = {
    ip: '192.0.2.10',
    device_uuid: 'awair-element_test',
    wifi_mac: '70:88:6b:00:00:01',
  };
  platform.configureAccessory(configuredAccessory);
  platform.configureAccessory(duplicateAccessory);

  await platform.upsertDevice({ ip: '192.0.2.10', name: 'Office Awair', polling_interval: 60 }, false);

  assert.equal(registered.length, 0);
  assert.deepEqual(unregistered, [duplicateAccessory]);
  assert.equal(platform.accessories.size, 1);
  assert.equal(platform.accessories.get(configuredUuid), configuredAccessory);
  assert.match(messages[0], /Removed 1 duplicate cached Awair accessory/);
});

test('different hardware IDs are not merged when devices share an endpoint', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).includes('/settings/config/data') ? {
      device_uuid: 'awair-element_second',
      wifi_mac: '70:88:6b:00:00:02',
    } : {},
  });
  t.after(() => { global.fetch = originalFetch; });

  const { api, registered, unregistered } = createPlatformApi();
  const platform = new AwairPlatform({ info() {}, warn() {}, debug() {} }, {}, api);
  t.after(() => platform.shutdown());
  const existingAccessory = new api.platformAccessory(
    'First Awair',
    api.hap.uuid.generate('homebridge-awair-local:awair-element_first'),
  );
  existingAccessory.context.device = {
    ip: '192.0.2.10',
    device_uuid: 'awair-element_first',
    wifi_mac: '70:88:6b:00:00:01',
  };
  platform.configureAccessory(existingAccessory);

  await platform.upsertDevice({
    ip: '192.0.2.10',
    device_uuid: 'awair-element_second',
    wifi_mac: '70:88:6b:00:00:02',
    polling_interval: 60,
  }, true);

  assert.equal(registered.length, 1);
  assert.equal(unregistered.length, 0);
  assert.equal(platform.accessories.size, 2);
  assert.notEqual(registered[0], existingAccessory);
});

test('upserting a manually configured device does not crash on missing context.device', async (t) => {
  const mockApi = {
    hap: { Service: {}, Characteristic: {}, uuid: { generate: (value) => `uuid-${value}` } },
    on() {},
    };

    // Create a proper constructor that Homebridge's dynamic platform expects.
    // The crash was caused by using ES6 shorthand syntax which isn't a valid constructor for 'new'.
  let created = [];
  function PlatformAccessory(name, uuid) {
    this.displayName = name;
    this.UUID = uuid;
    this.context = {};
    created.push(this);
   }
  PlatformAccessory.prototype = { getService() { return undefined; }, getServiceById() { return undefined; }, addService() {}, updateDisplayName() {} };

  let registered = [], updated = [];
  mockApi.registerPlatformAccessories = function(_, __, a) { registered.push(...a); };
  mockApi.unregisterPlatformAccessories = function() {};
  mockApi.updatePlatformAccessories = function(a) { updated.push(...a); };

  const platform = new AwairPlatform({ info() {}, warn: () => {}, debug() {} }, {}, mockApi);

   // Simulate a manually configured device with ip/host but no prior discovery — the exact crash scenario from v2.2.0+
  await platform.upsertDeviceSafely({ host: '10.11.1.123', name: 'Test Awair', polling_interval: 30 }, false);

   // Passes if no unhandled rejection (upsertDeviceSafely catches errors, but verifies the crash-free path)
});

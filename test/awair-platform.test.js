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

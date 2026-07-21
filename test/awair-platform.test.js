'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AwairPlatform } = require('../src/awair-platform');
const { AwairAccessory } = require('../src/awair-accessory');

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

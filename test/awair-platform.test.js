'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { AwairPlatform } = require('../src/awair-platform');

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

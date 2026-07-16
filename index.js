'use strict';

const { AwairPlatform } = require('./src/awair-platform');

const PLUGIN_NAME = 'homebridge-awair-local';
const PLATFORM_NAME = 'AwairLocal';

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, AwairPlatform);
};

'use strict';

const DEFAULT_VOC_MW = 72.6657827301974;

class AwairAccessory {
  static async identify(config) {
    const endpoint = buildEndpoint(config, '/settings/config/data');
    let settings = {};
    try {
      settings = await getJson(endpoint, config.requestTimeout || 5000);
    } catch (error) {
      // Explicitly configured devices must remain usable if this optional endpoint is unavailable.
      if (!config.ip && !config.host) throw error;
    }
    return {
      ...config,
      ...settings,
      ip: settings.ip || config.ip,
      host: config.host,
      model: modelFromUuid(settings.device_uuid) || config.model || config.devType || 'Awair',
      serial: settings.wifi_mac || settings.device_uuid || config.serial || config.ip || config.host,
      version: settings.fw_version || config.version || 'unknown',
      manufacturer: config.manufacturer || 'Awair',
    };
  }

  constructor(platform, accessory, config) {
    this.platform = platform;
    this.accessory = accessory;
    this.config = config;
    this.Service = platform.Service;
    this.Characteristic = platform.Characteristic;
    this.intervalSeconds = positiveNumber(config.polling_interval, 10);
    this.carbonDioxideThreshold = number(config.carbonDioxideThreshold, 1000);
    this.carbonDioxideThresholdOff = number(config.carbonDioxideThresholdOff, 800);
    this.vocMW = number(config.voc_mixture_mw, DEFAULT_VOC_MW);
    this.airQualityMethod = config.air_quality_method || 'awair-pm25';
    this.loggingLevel = number(config.logging_level, 0);
    this.logging = Boolean(config.logging) || this.loggingLevel > 0;
    this.timer = undefined;
    this.polling = false;
    this.createServices();
  }

  createServices() {
    const { Service, Characteristic } = this;
    this.information = this.accessory.getService(Service.AccessoryInformation) || this.accessory.addService(Service.AccessoryInformation);
    this.information
      .setCharacteristic(Characteristic.Manufacturer, this.config.manufacturer)
      .setCharacteristic(Characteristic.Model, this.config.model)
      .setCharacteristic(Characteristic.SerialNumber, this.config.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.config.version);

    this.airQuality = service(this.accessory, Service.AirQualitySensor, 'Air Quality');
    this.temperature = service(this.accessory, Service.TemperatureSensor, 'Temperature');
    this.humidity = service(this.accessory, Service.HumiditySensor, 'Humidity');
    this.temperature.getCharacteristic(Characteristic.CurrentTemperature).setProps({ minValue: -100, maxValue: 100 });
    this.airQuality.getCharacteristic(Characteristic.VOCDensity).setProps({ minValue: 0, maxValue: 100000 });

    if (!isMint(this.config)) this.carbonDioxide = service(this.accessory, Service.CarbonDioxideSensor, 'Carbon Dioxide');
    if (isLightModel(this.config)) {
      this.light = service(this.accessory, Service.LightSensor, 'Light Level');
      this.light.getCharacteristic(Characteristic.CurrentAmbientLightLevel).setProps({ minValue: 0.0001, maxValue: 64000 });
    }
    this.airQuality.setPrimaryService(true);
    this.airQuality.addLinkedService(this.temperature);
    this.airQuality.addLinkedService(this.humidity);
    if (this.carbonDioxide) this.airQuality.addLinkedService(this.carbonDioxide);
    if (this.light) this.airQuality.addLinkedService(this.light);
  }

  start() {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalSeconds * 1000);
  }

  shutdown() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const data = await getJson(buildEndpoint(this.config, '/air-data/latest'), this.config.requestTimeout || 5000);
      if (this.loggingLevel > 1) this.platform.log.debug?.(`[${this.config.serial}] ${JSON.stringify(data)}`);
      this.applyData(data);
    } catch (error) {
      if (this.logging) this.platform.log.warn(`[${this.config.serial}] could not read Awair data: ${error.message}`);
    } finally {
      this.polling = false;
    }
  }

  applyData(data) {
    const { Characteristic } = this;
    update(this.temperature, Characteristic.CurrentTemperature, data.temp);
    update(this.humidity, Characteristic.CurrentRelativeHumidity, data.humid);
    update(this.airQuality, Characteristic.VOCDensity, hasNumber(data.voc) ? convertChemicals(data.voc, this.vocMW, data.temp) : undefined);
    update(this.airQuality, Characteristic.PM2_5Density, data.pm25);
    update(this.airQuality, Characteristic.PM10Density, data.pm10_est);
    if (this.light) update(this.light, Characteristic.CurrentAmbientLightLevel, data.lux);
    if (this.carbonDioxide && hasNumber(data.co2)) {
      const co2 = Number(data.co2);
      update(this.carbonDioxide, Characteristic.CarbonDioxideLevel, co2);
      update(this.carbonDioxide, Characteristic.CarbonDioxideDetected, this.co2Detected(co2));
    }
    update(this.airQuality, Characteristic.AirQuality, airQuality(data, this.airQualityMethod));
  }

  co2Detected(co2) {
    if (this.carbonDioxideThreshold <= 0) return 0;
    const current = this.carbonDioxide.getCharacteristic(this.Characteristic.CarbonDioxideDetected).value;
    if (co2 >= this.carbonDioxideThreshold) return 1;
    if (co2 < this.carbonDioxideThresholdOff) return 0;
    return current === 1 ? 1 : 0;
  }
}

function service(accessory, Type, name) { return accessory.getServiceById(Type, name) || accessory.addService(Type, name, name); }
function update(service, characteristic, value) { if (service && hasNumber(value)) service.updateCharacteristic(characteristic, Number(value)); }
function hasNumber(value) { return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)); }
function number(value, fallback) { return hasNumber(value) ? Number(value) : fallback; }
function positiveNumber(value, fallback) { return number(value, fallback) > 0 ? number(value, fallback) : fallback; }
function isMint(config) { return String(config.model || config.device_uuid || '').toLowerCase().includes('mint'); }
function isLightModel(config) { return /mint|omni/.test(String(config.model || config.device_uuid || '').toLowerCase()); }
function modelFromUuid(uuid) { return uuid ? uuid.split('_')[0] : undefined; }
function buildEndpoint(config, path) {
  if (path.includes('air-data') && config.url) return config.url;
  if (path.includes('settings') && (config.configUrl || config.config_url)) return config.configUrl || config.config_url;
  const host = config.host || config.ip;
  if (!host) throw new Error('Awair endpoint has no host');
  const base = /^https?:\/\//.test(host) ? host : `http://${host}`;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}
async function getJson(url, timeout) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function convertChemicals(voc, mw, temp) { return (Number(voc) * mw * 101.32) / ((273.15 + number(temp, 20)) * 8.3144); }
function scoreQuality(score) { return score >= 90 ? 1 : score >= 80 ? 2 : score >= 60 ? 3 : score >= 50 ? 4 : 5; }
function pollutantQuality(value, bands) { const v = Number(value); return bands.findIndex((limit) => v < limit) + 1 || 5; }
function airQuality(data, method) {
  if (method === 'awair-pm25') return hasNumber(data.pm25) ? pollutantQuality(data.pm25, [15, 35, 55, 75]) : undefined;
  if (method === 'awair-aqi') {
    const values = [];
    if (hasNumber(data.voc)) values.push(pollutantQuality(data.voc, [333, 1000, 3333, 8332]));
    if (hasNumber(data.pm25)) values.push(pollutantQuality(data.pm25, [15, 35, 55, 75]));
    return values.length ? Math.max(...values) : undefined;
  }
  return hasNumber(data.score) ? scoreQuality(Number(data.score)) : undefined;
}

module.exports = { AwairAccessory, airQuality, convertChemicals, buildEndpoint };

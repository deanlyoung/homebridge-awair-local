const state = { config: {}, devices: [] };

window.addEventListener('DOMContentLoaded', load);
document.querySelector('#save').addEventListener('click', save);

async function load() {
  const configs = await homebridge.getPluginConfig();
  state.config = configs[0] || { platform: 'AwairLocal' };
  const discovered = await homebridge.request('/discovered-devices');
  state.devices = mergeDevices(state.config.devices || [], discovered);
  document.querySelector('#discovery').checked = state.config.discovery !== false;
  document.querySelector('#subnetDiscovery').checked = state.config.subnetDiscovery !== false;
  render();
}

function mergeDevices(configured, discovered) {
  const devices = configured.map((device) => ({ ...device, model: device.model || device.devType || '', managed: true }));
  const configuredIds = new Set(devices.map(identity));
  for (const device of discovered) {
    if (!configuredIds.has(identity(device))) devices.push({ ...device, managed: false, discovered: true });
  }
  return devices;
}

function render() {
  const container = document.querySelector('#devices');
  container.replaceChildren();
  document.querySelector('#empty').hidden = state.devices.length > 0;
  state.devices.forEach((device, index) => container.append(deviceCard(device, index)));
}

function deviceCard(device, index) {
  const column = element('div', 'col-12 col-xl-6');
  const card = element('section', 'card device-card h-100');
  card.dataset.managed = String(Boolean(device.managed));
  card.dataset.index = String(index);
  const title = device.name || device.displayName || device.device_uuid || device.host || device.ip || 'Awair';
  const endpoint = device.host || device.ip || '';
  card.innerHTML = `
    <div class="card-header d-flex justify-content-between align-items-center"><strong>${escapeHtml(title)}</strong><button class="btn btn-sm ${device.managed ? 'btn-outline-danger' : 'btn-outline-primary'} managed-toggle" type="button">${device.managed ? 'Remove' : 'Add'}</button></div>
    <div class="card-body">
      <p class="text-muted device-meta">${escapeHtml(device.device_uuid || device.wifi_mac || endpoint)}</p>
      <div class="row g-2">
        <label class="col-sm-4 col-form-label">Name</label><div class="col-sm-8"><input class="form-control" data-field="name" value="${escapeHtml(title)}"></div>
        <label class="col-sm-4 col-form-label">Host or IP</label><div class="col-sm-8"><input class="form-control" data-field="endpoint" value="${escapeHtml(endpoint)}"></div>
        <label class="col-sm-4 col-form-label">Air quality</label><div class="col-sm-8"><select class="form-select" data-field="air_quality_method"><option value="awair-pm25">PM2.5</option><option value="awair-score">Awair score</option><option value="awair-aqi">AQI</option></select></div>
        <label class="col-sm-4 col-form-label">CO₂ threshold</label><div class="col-sm-8"><input class="form-control" data-field="carbonDioxideThreshold" type="number" min="0" value="${escapeHtml(device.carbonDioxideThreshold ?? 0)}"></div>
        <label class="col-sm-4 col-form-label">CO₂ clear threshold</label><div class="col-sm-8"><input class="form-control" data-field="carbonDioxideThresholdOff" type="number" min="0" value="${escapeHtml(device.carbonDioxideThresholdOff ?? '')}"></div>
        <label class="col-sm-4 col-form-label">Polling seconds</label><div class="col-sm-8"><input class="form-control" data-field="polling_interval" type="number" min="1" value="${escapeHtml(device.polling_interval ?? 10)}"></div>
      </div>
      <details class="mt-3">
        <summary>Advanced settings</summary>
        <div class="row g-2 mt-1">
          <label class="col-sm-4 col-form-label">Model (device type)</label><div class="col-sm-8"><input class="form-control" data-field="model" value="${escapeHtml(device.model || device.devType || '')}" placeholder="awair-element"></div>
          <label class="col-sm-4 col-form-label">Manufacturer</label><div class="col-sm-8"><input class="form-control" data-field="manufacturer" value="${escapeHtml(device.manufacturer || 'Awair')}"></div>
          <label class="col-sm-4 col-form-label">Serial number</label><div class="col-sm-8"><input class="form-control" data-field="serial" value="${escapeHtml(device.serial || '')}"></div>
          <label class="col-sm-4 col-form-label">Firmware version</label><div class="col-sm-8"><input class="form-control" data-field="version" value="${escapeHtml(device.version || '')}"></div>
          <label class="col-sm-4 col-form-label">VOC molecular weight</label><div class="col-sm-8"><input class="form-control" data-field="voc_mixture_mw" type="number" min="0" step="any" value="${escapeHtml(device.voc_mixture_mw ?? 72.6657827301974)}"></div>
          <label class="col-sm-4 col-form-label">Legacy data-point limit</label><div class="col-sm-8"><input class="form-control" data-field="limit" type="number" min="1" value="${escapeHtml(device.limit ?? 1)}"></div>
          <label class="col-sm-4 col-form-label">Air-data URL override</label><div class="col-sm-8"><input class="form-control" data-field="url" type="url" value="${escapeHtml(device.url || '')}" placeholder="http://host/air-data/latest"></div>
          <label class="col-sm-4 col-form-label">Settings URL override</label><div class="col-sm-8"><input class="form-control" data-field="configUrl" type="url" value="${escapeHtml(device.configUrl || device.config_url || '')}" placeholder="http://host/settings/config/data"></div>
          <label class="col-sm-4 col-form-label">Request timeout (ms)</label><div class="col-sm-8"><input class="form-control" data-field="requestTimeout" type="number" min="1000" value="${escapeHtml(device.requestTimeout ?? 5000)}"></div>
          <label class="col-sm-4 col-form-label">Enable logging</label><div class="col-sm-8 pt-2"><input class="form-check-input" data-field="logging" type="checkbox" ${device.logging ? 'checked' : ''}></div>
          <label class="col-sm-4 col-form-label">Logging level</label><div class="col-sm-8"><input class="form-control" data-field="logging_level" type="number" min="0" value="${escapeHtml(device.logging_level ?? 0)}"></div>
        </div>
      </details>
    </div>`;
  const select = card.querySelector('[data-field="air_quality_method"]');
  select.value = device.air_quality_method || 'awair-pm25';
  card.querySelector('.managed-toggle').addEventListener('click', () => { state.devices[index].managed = !state.devices[index].managed; render(); });
  card.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('input', () => updateDevice(index, card, true));
    input.addEventListener('change', () => updateDevice(index, card, true));
  });
  column.append(card);
  return column;
}

function updateDevice(index, card, manage) {
  const device = state.devices[index];
  device.name = card.querySelector('[data-field="name"]').value.trim();
  const endpoint = card.querySelector('[data-field="endpoint"]').value.trim();
  delete device.ip; delete device.host;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(endpoint)) device.ip = endpoint; else device.host = endpoint;
  device.air_quality_method = card.querySelector('[data-field="air_quality_method"]').value;
  device.carbonDioxideThreshold = Number(card.querySelector('[data-field="carbonDioxideThreshold"]').value) || 0;
  device.polling_interval = Number(card.querySelector('[data-field="polling_interval"]').value) || 10;
  optionalText(device, 'model', card);
  delete device.devType;
  optionalText(device, 'manufacturer', card);
  optionalText(device, 'serial', card);
  optionalText(device, 'version', card);
  optionalNumber(device, 'carbonDioxideThresholdOff', card);
  device.voc_mixture_mw = Number(card.querySelector('[data-field="voc_mixture_mw"]').value) || 72.6657827301974;
  device.limit = Number(card.querySelector('[data-field="limit"]').value) || 1;
  optionalText(device, 'url', card);
  optionalText(device, 'configUrl', card);
  delete device.config_url;
  device.requestTimeout = Number(card.querySelector('[data-field="requestTimeout"]').value) || 5000;
  device.logging = card.querySelector('[data-field="logging"]').checked;
  device.logging_level = Number(card.querySelector('[data-field="logging_level"]').value) || 0;
  if (manage) device.managed = true;
}

async function save() {
  document.querySelectorAll('.device-card').forEach((card) => updateDevice(Number(card.dataset.index), card, false));
  state.config.discovery = document.querySelector('#discovery').checked;
  state.config.subnetDiscovery = document.querySelector('#subnetDiscovery').checked;
  state.config.devices = state.devices.filter((device) => device.managed).map(cleanDevice);
  await homebridge.updatePluginConfig([state.config]);
  await homebridge.savePluginConfig();
  homebridge.toast.success('Awair configuration saved. Restart Homebridge to apply changes.');
}

function cleanDevice(device) {
  const { managed, discovered, displayName, uuid, device_uuid, wifi_mac, fw_version, ...config } = device;
  return config;
}

function optionalText(device, field, card) {
  const value = card.querySelector(`[data-field="${field}"]`).value.trim();
  if (value) device[field] = value; else delete device[field];
}

function optionalNumber(device, field, card) {
  const value = card.querySelector(`[data-field="${field}"]`).value;
  if (value === '') delete device[field]; else device[field] = Number(value);
}

function identity(device) { return device.serial || device.wifi_mac || device.device_uuid || device.host || device.ip || device.uuid; }
function element(tag, className) { const node = document.createElement(tag); node.className = className; return node; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

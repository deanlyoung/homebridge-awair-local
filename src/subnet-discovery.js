'use strict';

const { networkInterfaces } = require('node:os');
const { buildEndpoint } = require('./awair-accessory');

const DEFAULT_MAX_HOSTS = 254;
const DEFAULT_CONCURRENCY = 24;
const DEFAULT_TIMEOUT = 1500;

// Some Awair models answer mDNS hostname lookups but do not advertise a DNS-SD
// service. Probe small private IPv4 subnets as a fallback for those devices.
class SubnetDiscovery {
  constructor({ log, onDevice, maxHosts = DEFAULT_MAX_HOSTS, concurrency = DEFAULT_CONCURRENCY, timeout = DEFAULT_TIMEOUT }) {
    this.log = log;
    this.onDevice = onDevice;
    this.maxHosts = positiveInteger(maxHosts, DEFAULT_MAX_HOSTS);
    this.concurrency = positiveInteger(concurrency, DEFAULT_CONCURRENCY);
    this.timeout = positiveInteger(timeout, DEFAULT_TIMEOUT);
    this.controllers = new Set();
    this.stopped = false;
  }

  start() {
    this.scan().catch((error) => this.log.debug?.(`Subnet discovery error: ${error.message}`));
  }

  stop() {
    this.stopped = true;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }

  async scan() {
    const subnets = privateSubnets(this.maxHosts);
    if (!subnets.length) return;
    const hosts = [...new Set(subnets.flatMap(hostsForSubnet))];
    await runWithConcurrency(hosts, this.concurrency, (ip) => this.verify(ip));
  }

  async verify(ip) {
    if (this.stopped) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);
    this.controllers.add(controller);
    try {
      const response = await fetch(buildEndpoint({ ip }, '/settings/config/data'), { signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if (data.device_uuid && /^awair-/i.test(data.device_uuid)) this.onDevice({ ...data, ip: data.ip || ip });
    } catch (_) {
      // Most addresses are not Awairs, so connection failures are expected.
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(controller);
    }
  }
}

function privateSubnets(maxHosts) {
  const subnets = new Map();
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal || !isPrivate(address.address)) continue;
      const mask = ipv4ToInt(address.netmask);
      const prefix = maskPrefix(mask);
      if (prefix === undefined) continue;
      const hostCount = (2 ** (32 - prefix)) - 2;
      if (hostCount < 1 || hostCount > maxHosts) continue;
      const network = ipv4ToInt(address.address) & mask;
      subnets.set(`${network}/${prefix}`, { network, prefix });
    }
  }
  return [...subnets.values()];
}

function hostsForSubnet({ network, prefix }) {
  const count = (2 ** (32 - prefix)) - 2;
  return Array.from({ length: count }, (_, index) => intToIpv4(network + index + 1));
}

async function runWithConcurrency(items, concurrency, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }));
}

function isPrivate(address) {
  const [first, second] = address.split('.').map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function ipv4ToInt(address) {
  return address.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function intToIpv4(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function maskPrefix(mask) {
  const bits = mask.toString(2).padStart(32, '0');
  return /^1*0*$/.test(bits) ? bits.indexOf('0') === -1 ? 32 : bits.indexOf('0') : undefined;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

module.exports = { SubnetDiscovery, privateSubnets, hostsForSubnet };

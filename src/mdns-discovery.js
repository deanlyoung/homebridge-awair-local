'use strict';

const dgram = require('node:dgram');
const { buildEndpoint } = require('./awair-accessory');

// DNS-SD discovery is intentionally followed by an Awair settings request; service names are not trusted.
class MdnsDiscovery {
  constructor({ log, serviceTypes, hostnames, onDevice }) {
    this.log = log;
    this.serviceTypes = serviceTypes || ['_http._tcp.local'];
    this.hostnames = hostnames || [];
    this.onDevice = onDevice;
    this.socket = undefined;
    this.timer = undefined;
    this.seen = new Set();
    this.serviceInstances = new Set();
  }

  start() {
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket.on('message', (message) => this.handle(message));
    this.socket.on('error', (error) => this.log.debug?.(`mDNS discovery error: ${error.message}`));
    this.socket.bind(5353, () => {
      try { this.socket.addMembership('224.0.0.251'); } catch (error) { this.log.warn(`Could not join mDNS multicast: ${error.message}`); }
      this.query();
      this.timer = setInterval(() => this.query(), 5 * 60 * 1000);
    });
    for (const host of this.hostnames) this.verify(host);
  }

  stop() { if (this.timer) clearInterval(this.timer); this.socket?.close(); }
  query() { for (const type of this.serviceTypes) this.queryRecord(type); }
  queryRecord(name, type = 12) { this.socket?.send(dnsQuery(name, type), 5353, '224.0.0.251'); }
  handle(message) {
    for (const record of parseRecords(message)) {
      if (record.type === 12 && this.isServiceType(record.name)) {
        this.serviceInstances.add(record.target.toLowerCase());
        this.queryRecord(record.target, 33);
      }
      if ((record.type === 1 || record.type === 28) && /awair/i.test(record.name)) this.verify(record.name.replace(/\.$/, ''));
      if (record.type === 33 && (this.serviceInstances.has(record.name.toLowerCase()) || /awair/i.test(record.name) || /awair/i.test(record.target))) this.verify(record.target.replace(/\.$/, ''), record.port);
    }
  }
  isServiceType(name) { return this.serviceTypes.some((type) => type.replace(/\.$/, '').toLowerCase() === name.replace(/\.$/, '').toLowerCase()); }
  async verify(host, port = 80) {
    const key = `${host}:${port}`.toLowerCase();
    if (this.seen.has(key)) return;
    this.seen.add(key);
    try {
      const endpointHost = port === 80 ? host : `${host}:${port}`;
      const response = await fetch(buildEndpoint({ host: endpointHost }, '/settings/config/data'), { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.device_uuid || !/^awair-/i.test(data.device_uuid)) return;
      this.onDevice({ ...data, host: endpointHost });
    } catch (_) {
      // A non-Awair service is expected, but permit a later mDNS announcement to retry it.
      this.seen.delete(key);
    }
  }
}

function dnsQuery(name, type = 12) {
  const header = Buffer.alloc(12); header.writeUInt16BE(0, 0); header.writeUInt16BE(0, 2); header.writeUInt16BE(1, 4);
  const question = Buffer.alloc(4); question.writeUInt16BE(type, 0); question.writeUInt16BE(1, 2);
  return Buffer.concat([header, encodeName(name), question]);
}
function encodeName(name) {
  const labels = name.split('.').filter(Boolean).map((part) => Buffer.concat([Buffer.from([part.length]), Buffer.from(part)]));
  return Buffer.concat([...labels, Buffer.from([0])]);
}

// Keep parsing deliberately small: PTR, address, and SRV records are all discovery needs.
function parseRecords(message) {
  try {
    const count = message.readUInt16BE(6) + message.readUInt16BE(8) + message.readUInt16BE(10); let offset = 12; const records = [];
    const questions = message.readUInt16BE(4); for (let i = 0; i < questions; i++) { [, offset] = readName(message, offset); offset += 4; }
    for (let i = 0; i < count; i++) { let name; [name, offset] = readName(message, offset); const type = message.readUInt16BE(offset); const length = message.readUInt16BE(offset + 8); const start = offset + 10; offset = start + length; if (type === 12) { const [target] = readName(message, start); records.push({ name, type, target }); } else if (type === 33) { const port = message.readUInt16BE(start + 4); const [target] = readName(message, start + 6); records.push({ name, type, port, target }); } else records.push({ name, type }); }
    return records;
  } catch (_) { return []; }
}
function readName(message, offset, seen = new Set()) { const labels = []; let cursor = offset; let next; while (cursor < message.length) { const length = message[cursor]; if (!length) { next ??= cursor + 1; break; } if ((length & 0xc0) === 0xc0) { const pointer = ((length & 0x3f) << 8) | message[cursor + 1]; if (!seen.has(pointer)) { seen.add(pointer); const [suffix] = readName(message, pointer, seen); labels.push(suffix); } next ??= cursor + 2; break; } labels.push(message.subarray(cursor + 1, cursor + 1 + length).toString()); cursor += length + 1; } return [labels.filter(Boolean).join('.'), next ?? cursor]; }

module.exports = { MdnsDiscovery, dnsQuery, parseRecords };

# homebridge-awair-local

Homebridge v2 dynamic platform for Awair devices using their local API. It exposes temperature, humidity, CO2, TVOC, PM2.5, PM10 and (for Mint/Omni) light services. No Awair cloud credentials are needed.

## Requirements

- Homebridge 2.0 or newer
- Node.js 18 or newer
- Awair Local API enabled. The device must answer `/air-data/latest` and `/settings/config/data` on the local network.

## Configuration

Use a single platform entry rather than the former `accessories` entries:

```json
{
  "platform": "AwairLocal",
  "name": "Awair Local",
  "discovery": true,
  "devices": [
    {
      "name": "Living Room Awair",
      "ip": "192.168.1.70",
      "carbonDioxideThreshold": 1200,
      "carbonDioxideThresholdOff": 1000,
      "air_quality_method": "awair-pm25",
      "polling_interval": 10
    }
  ]
}
```

All prior device settings are available inside `devices`: `ip`, `url`, `model`/`devType`, `manufacturer`, `serial`, `version`, `carbonDioxideThreshold`, `carbonDioxideThresholdOff`, `voc_mixture_mw`, `air_quality_method`, `polling_interval`, `limit`, `logging`, and `logging_level`. `configUrl`/`config_url` and `requestTimeout` are also supported. Defaults remain 10 seconds, `awair-pm25`, 1 data point, and a VOC molecular weight of 72.6657827301974.

## Discovery

Discovery is on by default. It browses `_http._tcp.local`, follows advertised HTTP service records, and only adds a service when its `/settings/config/data` response identifies an `awair-*` device. Some Awair models do not advertise a browsable DNS-SD service even though they support mDNS hostnames. For those models, the plugin also probes the Homebridge host's private IPv4 subnet (up to 254 usable addresses by default) and verifies each candidate with the same endpoint. Set `subnetDiscovery` to `false` to disable this fallback, or lower `subnetDiscoveryMaxHosts` to avoid scanning larger networks. Discovered accessories are cached by device UUID (or MAC address), so they survive restarts and receive address updates.

Awair documents mDNS hostnames (for example, `awair-elem-56cd78.local`) but does not document one DNS-SD service type for all models. Devices that advertise only a hostname cannot be enumerated by mDNS; add those names to `discoveryHostnames` or configure their `ip`/hostname in `devices`. You can customize `mdnsServiceTypes` for installations that know their service type.

## Migration

Replace each old `accessories` entry with an object in the platform's `devices` array, and replace `"accessory": "AwairLocal"` with `"platform": "AwairLocal"`. Existing setting names retain their meaning. The old `limit` option is retained for compatibility but has no effect on `/air-data/latest`, which returns one reading.

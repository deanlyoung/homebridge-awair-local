# homebridge-awair
Awair plugin for homebridge: https://github.com/nfarina/homebridge

Based on the great work of [@henrypoydar](https://github.com/henrypoydar).

This is a very basic plugin for Nfarina's amazing [Homebridge project](https://github.com/nfarina/homebridge). It will fetch current sensor conditions from an Awair device (e.g. Awair Glow C, Awair Mint, Awair Omni, Awair Element, or Awair 2nd Edition) and provide available sensor readings (e.g. temperature, humidity, carbon dioxide, TVOC, and PM2.5) information for HomeKit.

You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

It will get new data once every 10 seconds (default), but it can be customized in `config.json`.

# Installation

1. Install homebridge using: `[sudo] npm install -g homebridge`
2. Install this plugin using: `[sudo] npm install -g homebridge-awair-local`
3. Update your configuration file. See the sample below.

You'll need to request permission to use the "Local Sensors" feature by emailing: developer [at] getawair [dot] com

Once the feature is enabled, visit the IP Address of your device (found in your router settings). From this page, you can find 2 endpoints:
- `http://X.X.X.X/air-data/latest` (every time you refresh this page, the latest sensor values that are available will be presented)
- `http://X.X.X.X/settings/config/data` (this page displays device settings, such as `device_uuid`) For example (an Omni):

```
{"device_uuid":"awair-omni_123","wifi_mac":"70:88:6B:12:XX:XX","ip":"192.168.1.X","netmask":"192.168.1.254","gateway":"255.255.255.0","fw_version":"1.1.6","timezone":"America/Los_Angeles","display":"score","led": {"mode":"auto","brightness":20},"power-status": {"battery":99,"plugged":true}}
```


# Configuration

Configuration sample:

Add the following information to your config file (note: shown with (1) example device: Awair 2nd Edition).

See [config-sample.json](https://github.com/deanlyoung/homebridge-awair-local/blob/master/config-sample.json)


```
"accessories": [
	{
		"accessory": "Awair",
		"name": "Example Room 1 Awair",
		"ip": "X.X.X.X",
		"polling_interval": 10
	}
]
```

## Descriptions
```
	     `accessory`	=> The Homebridge Accessory (REQUIRED, must be exactly: `AwairLocal`)
		  `name`	=> The accessory name that appears by default in HomeKit (REQUIRED, can be anything)
		 `ip`	=> The IP Address of your Awair device on your local network, for example: 192.168.1.2 or 10.0.1.2, so it is recommended that you assign a DHCP Reservation to your device. (REQUIRED)
	  `manufacturer`	=> Manufacturer (OPTIONAL, default = `Awair`)
	       `devType`	=> Device Type (OPTIONAL, automatically captured from "/settings/config/data")
		 `devId`	=> Device ID (OPTIONAL, automatically captured from "/settings/config/data")
		`serial`	=> Serial Number (OPTIONAL, automatically captured from "/settings/config/data")
		 `model`	=> Device Model (OPTIONAL, automatically captured from "/settings/config/data")
`carbonDioxideThreshold`	=> (OPTIONAL, default = `0` [i.e. OFF], the level at which HomeKit will trigger an alert for the CO2 in ppm)
`carbonDioxideThresholdOff`	=> (OPTIONAL, default = `0` [i.e. `carbonDioxideThreshold`], the level at which HomeKit will turn off the trigger alert for the CO2 in ppm, to ensure that it doesn't trigger on/off too frequently choose a number lower than `carbonDioxideThreshold`)
	`voc_mixture_mw`	=> The Molecular Weight (g/mol) of a reference gas or mixture that you use to convert from ppb to ug/m^3 (OPTIONAL, default = `72.66578273019740`)
    `air_quality_method`	=> Air quality calculation method used to define the Air Quality Chracteristic (OPTIONAL, default = `awair-score`, options: `awair-score`, `aqi`, `nowcast-aqi`)
	       `polling`	=> The frequency (OPTIONAL, default = `10` (10 seconds), units: seconds, that you would like to update the data in HomeKit)
		 `limit`	=> Number of consecutive 10 second data points used for custom averaging of sensor values (OPTIONAL, default = `12` i.e. 2 minute average)
		   `url`	=> The Awair url to poll (OPTIONAL, EDITING NOT RECOMMENDED)
	 `configUrl`	=> The Awair Config url to poll (OPTIONAL, EDITING NOT RECOMMENDED)
	       `logging`	=> Whether to output logs to the Homebridge logs (OPTIONAL, default = `false`)
```

# API Response

See response.sample.json

# Resources

- Awair: https://getawair.com/
- Homebridge: https://github.com/nfarina/homebridge
- Homebridge plugin development: http://blog.theodo.fr/2017/08/make-siri-perfect-home-companion-devices-not-supported-apple-homekit/
- List of Services and conventions: https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js
- Another Awair plugin: https://github.com/henrypoydar/homebridge-awair-glow
- Reference AQ plugin: https://github.com/toto/homebridge-airrohr
- Refenerce temperature plugin: https://github.com/metbosch/homebridge-http-temperature
- AQI Calculation NPM package: https://www.npmjs.com/package/aqi-bot

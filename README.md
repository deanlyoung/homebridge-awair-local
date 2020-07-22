# homebridge-awair-local
Awair plugin for homebridge: https://github.com/nfarina/homebridge

Based on the great work of [@henrypoydar](https://github.com/henrypoydar).

This is a very basic plugin for Nfarina's amazing [Homebridge project](https://github.com/nfarina/homebridge). It will fetch current sensor conditions from an Awair device (e.g. Awair Mint, Awair Omni, Awair Element, or Awair 2nd Edition) and provide available sensor readings (e.g. temperature, humidity, carbon dioxide, TVOC, and PM2.5) information for HomeKit.

You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

It will get new data once every 10 seconds (default), but it can be customized in `config.json`.

# Installation

1. Install homebridge using: `[sudo] npm install -g homebridge`
2. Install this plugin using: `[sudo] npm install -g homebridge-awair-local`
3. Update your configuration file. See the sample below.

~You'll need to request permission to use the "Local Sensors" feature by emailing: developer [at] getawair [dot] com or filling out this Beta list form: https://forms.gle/DmRyqwSS23Wvm6zf6~
Filling out the form is no longer needed (unless you have an unsupported device_type). You can find this Beta feature in Device Settings (gear icon) > Developer Option > Enable Local Sensors of the Awair Home app. (note: even though the button will return to "blue" if you return, the feature should still be enabled, unless you Factory Reset the device.)

- Once the feature is enabled, visit the IP Address of your device (found in your router settings). From this page, you can find 2 endpoints:
- `http://X.Y.Z.W/air-data/latest` (every time you refresh this page, the latest sensor values that are available will be presented)
- `http://X.Y.Z.W/settings/config/data` (this page displays device settings, such as `device_uuid`) For example (an Omni):

```
{"device_uuid":"awair-omni_123","wifi_mac":"70:88:6B:12:XX:XX","ip":"192.168.1.X","netmask":"255.255.255.0","gateway":"192.168.1.254","fw_version":"1.1.9","timezone":"America/Los_Angeles","display":"score","led": {"mode":"auto","brightness":20},"power-status": {"battery":99,"plugged":true}}
```


# Configuration

Configuration sample:

Add the following information to your config file (note: shown with (1) example device: Awair).

See [config-sample.json](https://github.com/deanlyoung/homebridge-awair-local/blob/master/config-sample.json)


```
"accessories": [
	{
		"accessory": "AwairLocal",
		"name": "Example Room 1 Awair",
		"ip": "X.X.X.X",
		"manufacturer": "Awair",
		"devType": "awair",
		"devId": "123",
		"serial": "example-serial_123",
		"model": "Awair",
		"carbonDioxideThreshold": 1200,
		"carbonDioxideThresholdOff": 1200,
		"voc_mixture_mw": 72.66578273019740,
		"air_quality_method": "awair-score",
		"polling_interval": 10,
		"limit": 12,
		"logging": false
	}
]
```

## Descriptions
```
	     `accessory`	=> The Homebridge Accessory (REQUIRED, must be exactly: `AwairLocal`)
		  `name`	=> The accessory name that appears by default in HomeKit (REQUIRED, can be anything)
		 `token`	=> Developer Token (REQUIRED, see [Installation](#installation))
	  `manufacturer`	=> Manufacturer (OPTIONAL, default = `Awair`)
	       `devType`	=> Device Type (REQUIRED, options: `awair`, `awair-glow`, `awair-mint`, `awair-omni`, or `awair-r2`)
		 `devId`	=> Device ID (REQUIRED, see [Installation](#installation))
		`serial`	=> Serial Number (OPTIONAL, default = `devType_devId`, options: `mac-address` or `devType_devId`)
		 `model`	=> Device Model (OPTIONAL, default = `devType`, options: `Awair`, `Awair Glow`, `Awair Mint`, `Awair Omni`, `Awair 2nd Edition`)
`carbonDioxideThreshold`	=> (OPTIONAL, default = `0` [i.e. OFF], the level at which HomeKit will trigger an alert for the CO2 in ppm)
`carbonDioxideThresholdOff`	=> (OPTIONAL, default = `0` [i.e. `carbonDioxideThreshold`], the level at which HomeKit will turn off the trigger alert for the CO2 in ppm, to ensure that it doesn't trigger on/off too frequently choose a number lower than `carbonDioxideThreshold`)
	`voc_mixture_mw`	=> The Molecular Weight (g/mol) of a reference gas or mixture that you use to convert from ppb to ug/m^3 (OPTIONAL, default = `72.66578273019740`)
    `air_quality_method`	=> Air quality calculation method used to define the Air Quality Chracteristic (OPTIONAL, default = `awair-score`, options: `awair-score`, `aqi`, `nowcast-aqi`)
	      `endpoint`	=> The `/air-data` endpoint to use (OPTIONAL, default = `15-min-avg`, options: `15-min-avg`, `5-min-avg`, `raw`, or `latest`)
	       `polling`	=> The frequency (OPTIONAL, default = `900` (15 minutes), units: seconds, that you would like to update the data in HomeKit)
	      `userType`	=> The type of user account (OPTIONAL, default = `users/self`, options: `users/self` or `orgs/###`, where ### is the Awair Organization `orgId`)
		 `limit`	=> Number of consecutive 10 second data points returned per request, used for custom averaging of sensor values from `/raw` endpoint (OPTIONAL, default = `12` i.e. 2 minute average)
		   `url`	=> The Awair url to poll (OPTIONAL, default = `http://developer-apis.awair.is/v1/users/self/devices/:device_type/:device_id/air-data/:endpoint?limit=:limit&desc=true`, EDITING NOT RECOMMENDED)
	       `logging`	=> Whether to output logs to the Homebridge logs (OPTIONAL, default = `false`)
```

# API Response

See response.sample.json

# Resources

- Awair API: https://docs.developer.getawair.com/
- Homebridge: https://github.com/nfarina/homebridge
- Homebridge plugin development: http://blog.theodo.fr/2017/08/make-siri-perfect-home-companion-devices-not-supported-apple-homekit/
- List of Services and conventions: https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js
- Another Awair plugin: https://github.com/henrypoydar/homebridge-awair-glow
- Reference AQ plugin: https://github.com/toto/homebridge-airrohr
- Refenerce temperature plugin: https://github.com/metbosch/homebridge-http-temperature
- AQI Calculation NPM package: https://www.npmjs.com/package/aqi-bot

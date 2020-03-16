var Service, Characteristic;
var request = require("request-promise");
const packageJSON = require("./package.json");
let aqibot = require("aqi-bot");

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	
	homebridge.registerAccessory("homebridge-awair-local", "AwairLocal", AwairLocal);
};

function AwairLocal(log, config) {
	this.log = log;
	this.logging = config["logging"] || false;
	this.ip = config["ip"];
	this.carbonDioxideThreshold = Number(config["carbonDioxideThreshold"]) || 0; // ppm, 0 = OFF
	this.carbonDioxideThresholdOff = Number(config["carbonDioxideThresholdOff"]) || Number(this.carbonDioxideThreshold); // ppm, same as carbonDioxideThreshold by default, should be less than or equal to carbonDioxideThreshold
	this.vocMW = Number(config["voc_mixture_mw"]) || 72.66578273019740; // Molecular Weight (g/mol) of a reference VOC gas or mixture
	this.airQualityMethod = config["air_quality_method"] || "awair-score"; // awair-score, aqi, nowcast-aqi
	this.polling_interval = Number(config["polling_interval"]) || 10; // seconds (default: 10 seconds)
	this.limit = Number(config["limit"]) || 12; // consecutive 10 second samples averaged (default: 12 x 10 = 120 seconds)
	this.url = config["url"] || "http://" + this.ip + "/air-data/latest";
	this.configUrl = config["url"] || "http://" + this.ip + "/settings/config/data";
	this.manufacturer = config["manufacturer"] || "Awair";
	this.model = config["model"] ||  "unknown model";
	this.devType = this.model;
	this.serial = config["serial"] || "unknown serial";
	this.version = config["version"] || "unknown version";
}

AwairLocal.prototype = {
	getData: function() {
		var options = {
			method: "GET",
			uri: this.url,
			json: true
		};
		
		if(this.logging){this.log("[" + this.serial + "] url: " + this.url)};
		
		var that = this;
		
		return request(options)
			.then(function(response) {
				var data = response;
				
				var score = data.score;
				
				that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, that.convertScore(score));
				that.airQualityService.isPrimaryService = true;
				if (that.devType == "awair-mint") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService, that.lightLevelService];
				} else if (that.devType == "awair-glow-c") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService];
				} else if (that.devType == "awair-omni") {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService, that.carbonDioxideService, that.lightLevelService];
				} else {
					that.airQualityService.linkedServices = [that.humidityService, that.temperatureService, that.carbonDioxideService];
				}
				
				var temp = parseFloat(data.temp);
				var atmos = 1;
				
				if(that.logging){that.log("[" + that.serial + "] " + that.url + ": " + JSON.stringify(data) + ", score: " + score)};
				
				for (var sensor in data) {
					switch (sensor) {
						case "temp":
							// Temperature (C)
							that.temperatureService
								.setCharacteristic(Characteristic.CurrentTemperature, parseFloat(data[sensor]))
							break;
						case "humid":
							// Humidity (%)
							that.humidityService
								.setCharacteristic(Characteristic.CurrentRelativeHumidity, parseFloat(data[sensor]))
							break;
						case "co2":
							// Carbon Dioxide (ppm)
							var co2 = parseFloat(data[sensor]);
							var co2Detected;
							
							var co2Before = that.carbonDioxideService.getCharacteristic(Characteristic.CarbonDioxideDetected).value;
							if(that.logging){that.log("[" + that.serial + "] CO2Before: " + co2Before)};
							
							// Logic to determine if Carbon Dioxide should trip a change in Detected state
							that.carbonDioxideService
								.setCharacteristic(Characteristic.CarbonDioxideLevel, parseFloat(data[sensor]))
							if ((that.carbonDioxideThreshold > 0) && (co2 >= that.carbonDioxideThreshold)) {
								// threshold set and CO2 HIGH
								co2Detected = 1;
								if(that.logging){that.log("[" + that.serial + "] CO2 HIGH: " + co2 + " > " + that.carbonDioxideThreshold)};
							} else if ((that.carbonDioxideThreshold > 0) && (co2 < that.carbonDioxideThresholdOff)) {
								// threshold set and CO2 LOW
								co2Detected = 0;
								if(that.logging){that.log("[" + that.serial + "] CO2 NORMAL: " + co2 + " < " + that.carbonDioxideThresholdOff)};
							} else if ((that.carbonDioxideThreshold > 0) && (co2 < that.carbonDioxideThreshold) && (co2 > that.carbonDioxideThresholdOff)) {
								// the inbetween...
								if(that.logging){that.log("[" + that.serial + "] CO2 INBETWEEN: " + that.carbonDioxideThreshold + " > [[[" + co2 + "]]] > " + that.carbonDioxideThresholdOff)};
								co2Detected = co2Before;
							} else {
								// threshold NOT set
								co2Detected = 0;
								if(that.logging){that.log("[" + that.serial + "] CO2: " + co2)};
							}
							
							// Prevent sending a Carbon Dioxide detected update if one has not occured
							if ((co2Before == 0) && (co2Detected == 0)) {
								// CO2 low already, don't send
								if(that.logging){that.log("Carbon Dioxide already low.")};
							} else if ((co2Before == 0) && (co2Detected == 1)) {
								// CO2 low to high, send it!
								that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideDetected, co2Detected);
								if(that.logging){that.log("Carbon Dioxide low to high.")};
							} else if ((co2Before == 1) && (co2Detected == 1)) {
								// CO2 high to not-quite-low-enough-yet, don't send
								if(that.logging){that.log("Carbon Dioxide already elevated.")};
							} else if ((co2Before == 1) && (co2Detected == 0)) {
								// CO2 low to high, send it!
								that.carbonDioxideService.setCharacteristic(Characteristic.CarbonDioxideDetected, co2Detected);
								if(that.logging){that.log("Carbon Dioxide high to low.")};
							} else {
								// CO2 unknown...
								if(that.logging){that.log("Carbon Dioxide state unknown.")};
							}
							break;
						case "voc":
							var voc = parseFloat(data[sensor]);
							var tvoc = that.convertChemicals(voc, atmos, temp);
							if(that.logging){that.log("[" + that.serial + "]: voc (" + voc + " ppb) => tvoc (" + tvoc + " ug/m^3)")};
							// Chemicals (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.VOCDensity, tvoc);
							break;
						case "pm25":
							// PM2.5 (ug/m^3)
							that.airQualityService
								.setCharacteristic(Characteristic.PM2_5Density, parseFloat(data[sensor]));
							break;
						case "lux":
							// Light (lux)
							that.lightLevelService
								.setCharacteristic(Characteristic.CurrentAmbientLightLevel, parseFloat(data[sensor]));
							break;
						case "spl_a":
							// Sound (dBA)
							// TODO: replace with a HomeKit service
							if(that.logging){that.log("[" + that.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(data[sensor]))};
							break;
						default:
							if(that.logging){that.log("[" + that.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(data[sensor]))};
							break;
					}
				}
			})
			.catch(function(err) {
				if(that.logging){that.log("[" + that.serial + "] " + err)};
				that.temperatureService
					.setCharacteristic(Characteristic.CurrentTemperature, "--")
				that.humidityService
					.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--")
				if (that.devType != "awair-mint" && that.devType != "awair-glow-c") {
					that.carbonDioxideService
						.setCharacteristic(Characteristic.CarbonDioxideLevel, "--")
						.setCharacteristic(Characteristic.CarbonDioxideDetected, "--")
				};
				if (that.devType == "awair-omni" || that.devType == "awair-mint") {
					that.lightLevelService
						.setCharacteristic(Characteristic.CurrentAmbientLightLevel, "--")
				};
				that.airQualityService
					.setCharacteristic(Characteristic.AirQuality, "--")
					.setCharacteristic(Characteristic.VOCDensity, "--")
					.setCharacteristic(Characteristic.PM10Density, "--")
					.setCharacteristic(Characteristic.PM2_5Density, "--")
			});
	},
	
	convertChemicals: function(voc, atmos, temp) {
		var that = this;
		
		var mw = parseFloat(that.vocMW);
		var voc = parseFloat(voc);
		var atmos = parseFloat(atmos);
		var temp = parseFloat(temp);
		var vocString = "(" + voc + " * " + mw + " * " + atmos + " * 101.32) / ((273.15 + " + temp + ") * 8.3144)";
		var tvoc = (voc * mw * atmos * 101.32) / ((273.15 + temp) * 8.3144);
		if(that.logging){that.log("[" + that.serial + "] ppb => ug/m^3 equation: " + vocString)};
		return tvoc;
	},
	
	convertScore: function(score) {
		var that = this;
		var method = that.airQualityMethod;
		
		switch (method) {
			case "awair-score":
				var score = parseFloat(score);
				if (score >= 90) {w
					return 1; // EXCELLENT
				} else if (score >= 80 && score < 90) {
					return 2; // GOOD
				} else if (score >= 60 && score < 80) {
					return 3; // FAIR
				} else if (score >= 50 && score < 60) {
					return 4; // INFERIOR
				} else if (score < 50) {
					return 5; // POOR
				} else {
					return 0; // Error
				}
				break;
			case "aqi":
				var aqurl = "http://" + that.ip + "/air-data/latest";
				if(that.logging){that.log(aqurl)};
				
				var aqoptions = {
					method: "GET",
					uri: aqurl,
					json: true
				};
				
				return request(aqoptions)
					.then(function(response) {
						var aqtemp,
							pm25,
							pm10,
							voc,
							aqi;
						
						var aqatmos = 1;
						
						var aqdata = response;
						
						aqtemp = parseFloat(aqdata[temp]);
						
						for (var aqsensor in aqdata) {
							switch (aqsensor) {
								case "voc":
									// Chemicals (ug/m^3)
									var aqvoc = parseFloat(aqdata[aqsensor]);
									var aqtvoc = that.convertChemicals(aqvoc, aqatmos, aqtemp);
									if(that.logging){that.log(aqtvoc)};
									aqtvoc = parseFloat(aqtvoc);
									aqibot.AQICalculator.getAQIResult("CO", aqtvoc).then((result) => {
										if(that.logging){that.log(JSON.stringify(result))};
										voc = result.aqi;
										if(that.logging){that.log("voc: " + voc)};
									}).catch(err => {
										if(that.logging){that.log("voc: " + err)};
									})
									break;
								case "pm25":
									// PM2.5 (ug/m^3)
									var pm25y = parseFloat(aqdata[aqsensor]);
									aqibot.AQICalculator.getAQIResult("PM2.5", pm25y).then((result) => {
										if(that.logging){that.log(JSON.stringify(result))};
										pm25 = result.aqi;
										if(that.logging){that.log("pm25: " + pm25)};
									}).catch(err => {
										if(that.logging){that.log("pm25: " + err)};
									})
									break;
								default:
									if(that.logging){that.log("[" + that.serial + "] ignoring " + JSON.stringify(aqsensor) + " for AQI: " + parseFloat(aqdata[aqsensor]))};
									break;
							}
						}
						
						if(that.logging){that.log("pm25: " + pm25 + " voc: " + voc)};
						
						if (pm25 > 0) {
							aqi = pm25;
						} else if (voc > 0) {
							aqi = voc;
						} else {
							aqi = -1;
						}
						
						if(that.logging){that.log("AQI: " + aqi)};
						
						if (aqi >= 0 && aqi <= 50) {
							return 1; // EXCELLENT
						} else if (aqi > 50 && aqi <= 100) {
							return 2; // GOOD
						} else if (aqi > 100 && aqi <= 150) {
							return 3; // FAIR
						} else if (aqi > 150 && aqi <= 200) {
							return 4; // INFERIOR
						} else if (aqi > 200) {
							return 5; // POOR
						} else {
							return 0; // Error
						}
					})
					.catch(function(err) {
						if(that.logging){that.log("Error retrieving air quality data: " + err)};
					});
				break;
			default:
				if(that.logging){that.log("No air quality method specified. Defaulting to awair-score method.")};
				var score = parseFloat(score);
				if (score >= 90) {
					return 1; // EXCELLENT
				} else if (score >= 80 && score < 90) {
					return 2; // GOOD
				} else if (score >= 60 && score < 80) {
					return 3; // FAIR
				} else if (score >= 50 && score < 60) {
					return 4; // INFERIOR
				} else if (score < 50) {
					return 5; // POOR
				} else {
					return 0; // Error
				}
				break;
		}
	},
	
	getServices: function() {
		var services = [];
		
		var informationService = new Service.AccessoryInformation();
		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)
			.setCharacteristic(Characteristic.FirmwareRevision, this.version);
		this.informationService = informationService;
		services.push(informationService);
		
		var airQualityService = new Service.AirQualitySensor();
		airQualityService
			.setCharacteristic(Characteristic.AirQuality, "--")
			.setCharacteristic(Characteristic.VOCDensity, "--")
			.setCharacteristic(Characteristic.PM10Density, "--")
			.setCharacteristic(Characteristic.PM2_5Density, "--");
		airQualityService
			.getCharacteristic(Characteristic.VOCDensity)
			.setProps({
				minValue: 0,
				maxValue: 100000
			});
		this.airQualityService = airQualityService;
		services.push(airQualityService);
		
		var temperatureService = new Service.TemperatureSensor();
		temperatureService
			.setCharacteristic(Characteristic.CurrentTemperature, "--");
		temperatureService
			.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: -100,
				maxValue: 100
			});
		this.temperatureService = temperatureService;
		services.push(temperatureService);
		
		var humidityService = new Service.HumiditySensor();
		humidityService
			.setCharacteristic(Characteristic.CurrentRelativeHumidity, "--");
		this.humidityService = humidityService;
		services.push(humidityService);
		
		if (this.devType != "awair-mint" && this.devType != "awair-glow-c") {
			var carbonDioxideService = new Service.CarbonDioxideSensor();
			carbonDioxideService
				.setCharacteristic(Characteristic.CarbonDioxideLevel, "--");
			this.carbonDioxideService = carbonDioxideService;
			services.push(carbonDioxideService);
		}
		
		if (this.devType == "awair-omni" || this.devType == "awair-mint") {
			var lightLevelService = new Service.LightSensor();
			lightLevelService
				.setCharacteristic(Characteristic.CurrentAmbientLightLevel, "--");
			lightLevelService
				.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
				.setProps({
					minValue: 0,
					maxValue: 64000
				});
			this.lightLevelService = lightLevelService;
			services.push(lightLevelService);
		}
		
		if (this.polling_interval > 0) {
			this.timer = setInterval(
				this.getData.bind(this),
				this.polling_interval * 1000
			);
		}
		
		// Get tnitial state
		this.getData().bind(this);
		
		return services;
	}
};
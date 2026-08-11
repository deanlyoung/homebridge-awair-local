# Change Log

All notable changes to `homebridge-awair-local` are documented in this file. This project follows [Semantic Versioning](https://semver.org/).

The entries below are based on the repository's release tags. Changes that were repeated in later merge or release notes are listed only with the first release that introduced them.

## v2.2.2 (2026-08-10)

### Fixed

- Prevented a crash when manually configuring a new device (`Cannot read properties of undefined (reading 'aliases')`).
- Added Homebridge badge

## v2.2.1 (2026-07-21)

### Fixed

- Made automatic device discovery opt-in when the setting is omitted.
- Awaited and safely handled asynchronous subnet-discovery callbacks.

## v2.2.0 (2026-07-21)

### Improved

- Deduplicated `.local` and IP discovery results by Awair UUID/MAC while retaining endpoint aliases.
- Used live device metadata for model, serial/MAC, and firmware details.
- Expanded the Homebridge settings UI with advanced per-device options, automatic management of edited discoveries, clearer numeric input, and dark-theme contrast.
- Set CO₂ defaults to a 1,000 ppm alert threshold and 800 ppm clear threshold, with integral threshold values.
- Persisted only supported, user-configurable plugin settings and made both settings-modal Save paths retain staged changes.

### Other Changes

- Added Homebridge verification metadata, security and contribution documentation, package-content checks, and test coverage.
- Raised the supported Node.js range to 22–24.

## v2.1.0 (2026-07-18)

### UI Changes

- Added a custom Homebridge Config UI X interface for viewing discovered Awairs and editing device overrides.
- Added controls for device name, host/IP, air-quality method, CO₂ threshold, polling interval, and automatic/subnet discovery.
- Added bounded, concurrent private-subnet discovery as a fallback for devices that do not advertise a DNS-SD service.
- Improved mDNS discovery by following DNS-SD PTR and SRV records, allowing discovery of Awairs whose hostnames do not contain `awair`.
- Changed the default air-quality method to `awair-pm25`; existing user settings remain unchanged.

## v2.0.1 (2026-07-17)

### Other Changes

- Republished the v2 platform migration with the corrected patch version; no functional changes beyond v2.0.0.

## v2.0.0 (2026-07-17)

### Breaking Changes

- Migrated from the legacy accessory plugin to a dynamic Homebridge platform plugin.

### Improved

- Added verified mDNS/DNS-SD Awair discovery and cached accessories.
- Preserved polling, sensor services, air-quality modes, VOC conversion, and CO₂ thresholds in the new platform.
- Updated the configuration schema, sample configuration, and migration documentation.

### Other Changes

- Modernized Node.js and Homebridge requirements, removed deprecated request dependencies, and updated npm publishing to trusted publishing with automated tagging.

## v1.3.1 (2021-05-22)

### Added

- Added `awair-pm25` and `awair-aqi` air-quality methods, support for local sensors, configurable logging, and schema-based configuration.
- Added separate CO₂ on/off thresholds and compatibility updates for different Awair sensor formats and models.

### Fixed

- Corrected device configuration handling, accessory naming, and documentation examples.

### Other Changes

- Updated Lodash security dependencies and the npm publishing workflow.

## v1.0.27 (2020-03-15)

### Improved

- Added IP-based automatic configuration and refined device-type handling.
- Improved chemical-temperature conversion and configurable CO₂ thresholds.

## v1.0.3 (2020-02-08)

### Fixed

- Read the Awair score before updating the HomeKit air-quality service.

## v1.0.2 (2020-02-08)

### Breaking Changes

- Renamed the plugin registration from `homebridge-awair` / `Awair` to `homebridge-awair-local` / `Awair Local`.

## v1.0.1 (2020-02-08)

### Added

- First tagged release of the local Awair Homebridge accessory plugin.

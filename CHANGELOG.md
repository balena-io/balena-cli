# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [2.5.0] - 2015-12-11

### Added

- Show device id in `resin devices`.
- Add helpful instructions after `resin quickstart`.
- Add timestamp to `resin logs` lines.

### Changed

- Lazy load command actions dependencies for performance reasons.

## [2.4.0] - 2015-12-01

### Added

- Show device types when selecting applications.
- Automatic token exchange login with the web dashboard.

### Changed

- Simplify download output messages.

## [2.3.0] - 2015-11-20

### Added

- Implement `settings` command.
- Handle Windows elevation automatically.

### Changed

- Show uuids in `devices` command.
- Clarify resin url in `login` and `whoami`.

## [2.2.0] - 2015-11-12

### Added

- Implement `device move` command.

## [2.1.0] - 2015-11-11

### Added

- Implement `config read` command.
- Implement `config write` command.

### Changed

- Clarify the need of computer password during `sudo` in `os initialize`.

## [2.0.1] - 2015-10-26

### Changed

- Fix critical error when elevating permissions.

## [2.0.0] - 2015-10-26

### Added

- Add `drive` option to `os initialize`.
- Add application name length validation.
- Allow passing a custom uuid to `device register`.
- Add `advanced` option in `device init`.
- Implement user/password login form with 2FA support.

### Changed

- Clarify the need for admin privileges on update.
- Fix non working `yes` option in `os initialize`.
- Fix non working `type` option in `app create`.
- Take device type as an option in `os initialize`.
- Improve the way the update notifier is shown.
- Ignore advanced configuration options by default.
- Fix	`device info` shadowing other command help pages.

### Removed

- Remove login with token functionality.
- Remove project directory creation logic in `device init`.
- Remove `app associate` command.

## [1.1.0] - 2015-10-13

### Added

- Implement `os download` command.
- Implement `os configure` command.
- Implement `os initialize` command.
- Implement `device register` command.
- Add TROUBLESHOOTING guide.
- Add a dynamic widget for selecting connected drives.

### Changed

- Make sure temporary files are removed on failures in `device init`.
- Prompt to select application if running `device init` with no arguments.
- Only use admin privileges in `os initialize` to avoid the cache directory to belong to `root`.
- Separate help output per relevance.
- Only print primary command help by default.
- Print plugin warnings in red as the rest of the errors.
- Shorten the length of device await message.
- Upgrade Resin SDK to v3.0.0.
- Check that a directory is a `git` repository before attempting to run `git` operations on it.
- Improve plugin scanning mechanism.
- Fix `EPERM` issue in Windows after a successfull `device init`.
- Fix SDCard burning issues in Windows 10.
- Fix plugins not being loaded in Windows 10.
- Fix bug when listing the available drives in Windows when the user name contains spaces.
- Fix an edge case that caused drives to be scanned incorrectly in OS X.
- Fix operating system not being detected correctly when initializing a device.

### Removed

- Remove outdated information from README.

[2.5.0]: https://github.com/resin-io/resin-cli/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/resin-io/resin-cli/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/resin-io/resin-cli/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/resin-io/resin-cli/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/resin-io/resin-cli/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/resin-io/resin-cli/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/resin-io/resin-cli/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/resin-io/resin-cli/compare/v1.0.0...v1.1.0

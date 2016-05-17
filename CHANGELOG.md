# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [4.0.3] - 2016-05-17

### Changed

- Fix `resin ssh` errors when running in `cmd.exe`.

## [4.0.2] - 2016-04-27

### Changed

- Upgrade `resin-sync` to v2.0.2.

## [4.0.1] - 2016-04-26

### Changed

- Fix unhandled exceptions in the `resin ssh` command.

## [4.0.0] - 2016-04-26

### Added

- Implement `resin ssh` command

### Changed

- Remove `resin sync` `exec` option.
- Upgrade `resin-sync` to v2.0.1.
- Upgrade `resin-sdk` to v5.3.0.

## [3.0.2] - 2016-04-08

### Changed

- Fix `os configure` command not working with shorter uuids.

## [3.0.1] - 2016-03-29

### Changed

- Log Mixpanel events based on the matching command signature.

## [3.0.0] - 2016-03-28

### Added

- Implement `config inject` command.
- Document the case where `EACCES` is thrown during login because of an expired token.
- Integrate `resin-plugin-sync` as a build-in command.

### Changed

- Allow `config generate` to generate a `config.json` for an application.
- Force update alert to always be shown.
- Only throw "Invalid 2FA code" if we're sure that's the cause during `login`.

## [2.7.0] - 2016-03-07

### Added

- Implement `config generate` command.
- Implement `device reboot` command.

## [2.6.2] - 2016-02-19

### Removed

- Remove debugging statement in `quickstart`.

## [2.6.1] - 2016-02-12

### Added

- Documented corrupted image MBR error.
- Show parser device status in `device` command.
- Show id a device is online in `devices` command.
- Make use of static images.

### Changed

- Improve analytics.
- Improve `quickstart` messages.
- Fix `device` example.

## [2.6.0] - 2016-01-21

### Added

- Add support for credential-based authentication.
- Redirect users to GitHub and Gitter in case of errors.
- Add Resin.io ASCII art header on `login`.
- Print an informative next-steps message after `login`.
- Print informative verbose help to `resin help`.
- Support for shorter uuids in all commands.

### Changed

- Change license to Apache 2.0.
- Don't make `device init` a primary command.
- Stop instructing users to run `quickstart` as root.
- Make `login` command purely interactive.
- Handle authentication in `quickstart` if user is not logged in.
- Redirect to `signup` from `login` if user doesn't have an account.
- Make sure to remove registered device resource in case of errors in `quickstart`.
- Upgrade Resin SDK to v5.0.1.
- Upgrade Resin Image Manager to v3.2.6.
- Make `devices` output shorter uuids.

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

[4.0.3]: https://github.com/resin-io/resin-cli/compare/v4.0.2...v4.0.3
[4.0.2]: https://github.com/resin-io/resin-cli/compare/v4.0.1...v4.0.2
[4.0.1]: https://github.com/resin-io/resin-cli/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/resin-io/resin-cli/compare/v3.0.2...v4.0.0
[3.0.2]: https://github.com/resin-io/resin-cli/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/resin-io/resin-cli/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/resin-io/resin-cli/compare/v2.7.0...v3.0.0
[2.7.0]: https://github.com/resin-io/resin-cli/compare/v2.6.2...v2.7.0
[2.6.2]: https://github.com/resin-io/resin-cli/compare/v2.6.1...v2.6.2
[2.6.1]: https://github.com/resin-io/resin-cli/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/resin-io/resin-cli/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/resin-io/resin-cli/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/resin-io/resin-cli/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/resin-io/resin-cli/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/resin-io/resin-cli/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/resin-io/resin-cli/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/resin-io/resin-cli/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/resin-io/resin-cli/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/resin-io/resin-cli/compare/v1.0.0...v1.1.0

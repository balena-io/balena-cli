# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased

### Added

- `package-lock.json` for `npm5` users
- Added ability to run an emulated build silently with resin build

## [5.10.2] - 2017-05-31

### Fixed

- Fixed command line arguments for `resin build`

## [5.10.1] - 2017-05-22

### Fixed

- Fixed breaking bug in `resin local ssh`

## [5.10.0] - 2017-05-22

### Added

- Reduce granularity of update checking to one day
- Include extra usage metadata in error logging to help debugging
- Add uploading of build logs when present with resin deploy
- Highlight cache usage in a local build
- Show a progress bar for upload progress
- Add ability to specify build-time variables for local builds
- Added the proxy support for the `resin ssh` command

### Fixed

- Fixed the not enough unicorns bug in resin build
- Removed the install-time warning for the `valid-email` package

## [5.9.1] - 2017-05-01

### Fixed

- Technical release because v5.9.0 was published earlier (erroneously)

## [5.9.0] - 2017-05-01

### Added

- HTTP(S) proxy support

## [5.8.1] - 2017-04-27

### Fixed

- The `ssh` command was broken

## [5.8.0] - 2017-04-26

### Added

- Add cloud builder output to local build
- Add nocache and tag options to resin deploy
- Add ability to build and deploy an image to resin's infrastructure

### Fixed

- Capture and report errors happening during the program initialization, like parsing invalid YAML config

## [5.7.2] - 2017-04-18

### Fixed

- Fixed warning on NPM install due to dependency conflicts
- Improved node v4 support (some operations are fixed, some will run faster)

## [5.7.1] - 2017-04-03

### Fixed

- Add basic support for the new ResinOS version format

## [5.7.0] - 2017-03-28

### Fixed

- The OS init issues:
	* failing to get the superuser resin auth (tried to look into `/root/.resin`)
	* failing to write to the drive

## [5.6.1] - 2017-03-23

### Added

- Add Sentry error tracking

### Fixed

- The unneeded warning about the default OS version download from the `device init` command.
- Changed the help references from gitter to forums.

## [5.6.0] - 2017-03-23

### Added

- The `--version` option to the `os download` command. Check `resin help os download` for details.

## [5.5.0] - 2017-03-10

### Added

- Require superuser for scan commands, also introduce docker timeout
- Bump resin-sync@7.0.0: use experimental rds which requires superuser permissions

## [5.4.0] - 2017-03-09

### Added

- Implement 'resin local stop'
- Implement 'resin local'
- Implement 'resin local push'
- Implement 'resin local ssh'
- Implement 'resin local scan'
- Implement 'resin local promote'
- Implement 'resin local logs'
- Implement 'resin local flash'
- Implement 'resin local configure'

### Changed

- Remove app create from primary commands

## [5.3.0] - 2017-03-03

### Added

- `resin sync` AUFS device support

### Changed

- Moved to the new version of `resin-sdk` (via `resin-sdk-preconfigured`)

## [5.2.4] - 2017-01-18

### Changed

- Fix documented requirements for resin ssh and resin sync

## [5.2.3] - 2017-01-04

### Changed

- Add missing `js-yaml` dependency.

## [5.2.2] - 2016-11-01

### Changed

- Fix `shutdown` command not being available.

## [5.2.1] - 2016-10-28

### Changed

- Fix `Boolean options can't have parameters` error in every command.

## [5.2.0] - 2016-10-27

### Added

- Add `shutdown` command.
- Add `--force` option to `device reboot` command.

## [5.1.0] - 2016-09-25

### Added

- Add `devices supported` command.

## [5.0.0] - 2016-09-15

### Added

- Automatically parse '.gitignore' for file inclusions/exclusions from resin sync by default. Skip parsing with `--skip-gitignore`.
- Automatically save options to `<sourceDirectory>/.resin-sync.yml` after every run.
- Support user-specified destination directories with `--destination/-d` option.
- Implement `--after` option to perform actions local (e.g. cleanup) after resin sync has finished.
- Implement interactive dialog for destination directory, with `/usr/src/app` being the default choice.

### Changed

- Require `resin sync` `--source/-s` option if a `.resin-sync.yml` file is not found in the current directory.
- Require `uuid` as an argument in `resin sync/ssh` (`appName` has been removed).
- Always display interactive device selection dialog when uuid is not passed as an argument.
- Disable ControlMaster ssh option (as reported in support).

## [4.5.0] - 2016-09-14

### Added

- Attempt to retrieve device type from the image's first partition.

## [4.4.0] - 2016-08-11

### Changed

- Display OS and Supervisor version in `devices` and `device` commands.

## [4.3.0] - 2016-08-11

### Added

- Implement `device public-url enable` command.
- Implement `device public-url disable` command.
- Implement `device public-url status` command.
- Implement `device public-url` command.
- Add global `--help` option.

## [4.2.1] - 2016-07-26

### Changed

- Fix log messages being `undefined`.

## [4.2.0] - 2016-06-22

### Added

- Add `verbose` option to `resin sync`.

## [4.1.0] - 2016-06-22

### Added

- Add `verbose` option to `resin ssh`.

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

[5.10.2]: https://github.com/resin-io/resin-cli/compare/v5.10.1...v5.10.2
[5.10.1]: https://github.com/resin-io/resin-cli/compare/v5.10.0...v5.10.1
[5.10.0]: https://github.com/resin-io/resin-cli/compare/v5.9.1...v5.10.0
[5.9.1]: https://github.com/resin-io/resin-cli/compare/v5.9.0...v5.9.1
[5.9.0]: https://github.com/resin-io/resin-cli/compare/v5.8.1...v5.9.0
[5.8.1]: https://github.com/resin-io/resin-cli/compare/v5.8.0...v5.8.1
[5.8.0]: https://github.com/resin-io/resin-cli/compare/v5.7.2...v5.8.0
[5.7.2]: https://github.com/resin-io/resin-cli/compare/v5.7.1...v5.7.2
[5.7.1]: https://github.com/resin-io/resin-cli/compare/v5.7.0...v5.7.1
[5.7.0]: https://github.com/resin-io/resin-cli/compare/v5.6.1...v5.7.0
[5.6.1]: https://github.com/resin-io/resin-cli/compare/v5.6.0...v5.6.1
[5.6.0]: https://github.com/resin-io/resin-cli/compare/v5.5.0...v5.6.0
[5.5.0]: https://github.com/resin-io/resin-cli/compare/v5.4.0...v5.5.0
[5.4.0]: https://github.com/resin-io/resin-cli/compare/v5.3.0...v5.4.0
[5.3.0]: https://github.com/resin-io/resin-cli/compare/v5.2.4...v5.3.0
[5.2.4]: https://github.com/resin-io/resin-cli/compare/v5.2.3...v5.2.4
[5.2.3]: https://github.com/resin-io/resin-cli/compare/v5.2.2...v5.2.3
[5.2.2]: https://github.com/resin-io/resin-cli/compare/v5.2.1...v5.2.2
[5.2.1]: https://github.com/resin-io/resin-cli/compare/v5.2.0...v5.2.1
[5.2.0]: https://github.com/resin-io/resin-cli/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/resin-io/resin-cli/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/resin-io/resin-cli/compare/v4.5.0...v5.0.0
[4.5.0]: https://github.com/resin-io/resin-cli/compare/v4.4.0...v4.5.0
[4.4.0]: https://github.com/resin-io/resin-cli/compare/v4.3.0...v4.4.0
[4.3.0]: https://github.com/resin-io/resin-cli/compare/v4.2.1...v4.3.0
[4.2.1]: https://github.com/resin-io/resin-cli/compare/v4.2.0...v4.2.1
[4.2.0]: https://github.com/resin-io/resin-cli/compare/v4.1.0...v4.2.0
[4.1.0]: https://github.com/resin-io/resin-cli/compare/v4.0.3...v4.1.0
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

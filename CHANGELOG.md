# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

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

[1.1.0]: https://github.com/resin-io/resin-cli/compare/v1.0.0...v1.1.0

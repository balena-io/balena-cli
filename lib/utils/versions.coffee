semver = require('semver')
pkg = require('../../package.json')

cli = semver.parse(pkg.version)

module.exports = {
	cli:
		raw: cli.raw
		major: cli.major
		minor: cli.minor
		patch: cli.patch
}

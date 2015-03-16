# app create <name>

Use this command to create a new resin.io application.

You can specify the application type with the `--type` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with

	$ resin devices supported

Examples:

	$ resin app create MyApp
	$ resin app create MyApp --type raspberry-pi

## Options

### --type, -t <type>

application type
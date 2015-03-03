# env add <key> [value]

Use this command to add an enviroment variable to an application.

You need to pass the `--application` option.

If value is omitted, the tool will attempt to use the variable's value
as defined in your host machine.

If the value is grabbed from the environment, a warning message will be printed.
Use `--quiet` to remove it.

Examples:

	$ resin env add EDITOR vim -a 91
	$ resin env add TERM -a 91

## Options

### --application, --a,app, --a,app <application>

application id
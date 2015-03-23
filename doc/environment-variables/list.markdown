# envs

Use this command to list all environment variables for a particular application.
Notice we will support per-device environment variables soon.

This command lists all custom environment variables set on the devices running
the application. If you want to see all environment variables, including private
ones used by resin, use the verbose option.

Example:

	$ resin envs --application 91
	$ resin envs --application 91 --verbose

## Options

### --application, --a,app, --a,app &#60;application&#62;

application name

### --verbose, -v

show private environment variables
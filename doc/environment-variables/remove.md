# env rm <id>

Use this command to remove an environment variable from an application.

Don't remove resin specific variables, as things might not work as expected.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin env rm 215
	$ resin env rm 215 --yes

## Options

### --yes, -y

confirm non interactively
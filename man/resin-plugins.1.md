resin-plugins(1) - Creating Resin CLI plugins
=============================================

## DESCRIPTION

Resin CLI plugins are managed by NPM. Installing an NPM module that starts with `resin-plugin-*` globally will automatically make it available to the Resin CLI.

## TUTORIAL

In this guide, we'll create a simple hello plugin that greets the user.

Create a directory called `resin-plugin-hello`, containing a single `index.js` file.

Within the new project, run `npm init` and make sure the package name is set to `resin-plugin-hello` as well.

Also make sure that you have a `main` field in `package.json` that points to the `index.js` file you created above.

Your `package.json` should look something like this:

	{
		"name": "resin-plugin-hello",
		"version": "1.0.0",
		"main": "index.js",
		"description": "My first Resin plugin",
		"license": "MIT"
	}

Your index file should export an object (if exposing a single command) or an array of objects (if exposing multiple commands).

Notice that is very important that your `package.json` `main` field points to the file that is exporting the commands for the plugin to work correctly.

Each object describes a single command. The accepted fields are:

- `signature`: A [Capitano](https://github.com/resin-io/capitano) signature.
- `description`: A string containing a short description of the command. This will be shown on the Resin general help.
- `help`: A string containing an usage help page. This will be shown when passing the signature to the `help` command.
- `action`: A function that defines the action to take when the command is matched. The function will be given 3 arguments (`params`, `options`, `done`).
- `permission`: A string describing the required permissions to run the command.
- `options`: An array of [Capitano](https://github.com/resin-io/capitano) options.

The `index.js` file should look something like:

	module.exports = [
		{
			signature: 'hello <name>',
			description: 'example plugin',
			help: 'This is an example plugin.',
			action: function(params, options, done) {
				console.log('Hey there ' + params.name + '!');
				done();
			}
		}
	]

As we're only exporting a single command, we can export the object directly:

	module.exports = {
		signature: 'hello <name>',
		description: 'example plugin',
		help: 'This is an example plugin',
		action: function(params, options, done) {
			console.log('Hey there ' + params.name + '!');
			done();
		}
	}

This example will register a `hello` command which requires a `name` parameter, and greets the user in result.

To test the plugin, first create a global link by running the following command inside your plugin directory:

	$ npm link

Now if you run `$ resin help` you should see your new command at the bottom of the list.

Try it out:

	$ resin hello Juan
	Hey there Juan!

## DONE CALLBACK

It's very important that you call the `done()` callback after your action finishes. If you pass an `Error` instance to `done()`, its message will be displayed by the Resin CLI, exiting with an error code 1.

If your action is synchronous and doesn't return any error, you can omit the `done()` callback all together. For example:

	module.exports = {
		signature: 'hello <name>',
		description: 'example plugin',
		help: 'This is an example plugin',
		action: function(params, options) {
			console.log('Hey there ' + params.name + '!');
		}
	}

## PERMISSIONS

You can set a command permission to restrict access to the commands. Currently, the only registered permission is `user`, which requires the user to log in to Resin from the CLI.

To require the user to login before calling our hello plugin, we can add `permission: 'user'` to the command description:

	module.exports = {
		signature: 'hello <name>',
		description: 'example plugin',
		help: 'This is an example plugin',
		permission: 'user',
		action: function(params, options, done) {
			console.log('Hey there ' + params.name + '!');
			done();
		}
	}

Now if the user attempts to call our command without being logged in, a nice error message asking him to login will be shown instead.

## OPTIONS

You can define certain options that your command accepts. Notice these are per command, and thus are not available to other command that doesn't declares them as well.

Let's say we want to allow the user to configure the greeting language. For example:

	$ resin hello Juan --language spanish

We first need to register the `language option`:

	module.exports = {
		signature: 'hello <name>',
		description: 'example plugin',
		help: 'This is an example plugin',
		options: [
			{
				signature: 'language',
				parameter: 'language',
				description: 'the greeting language',
				alias: 'l'
			}
		],
		action: function(params, options, done) {
			if(options.language === 'spanish') {
				console.log('Hola ' + params.name + '!');
			} else {
				console.log('Hey there ' + params.name + '!');
			}

			done();
		}
	}

Here, we declared an option with a signature of `language` (so we can use it as `--language`), a parameter name of `language` as well (this means we'll be able to access the option as the `language` key: `options.language`), a nice description and an alias `l` (which means we can use `-l <language>` too).

## COFFEESCRIPT

We have CoffeeScript support out of the box. Implement your commands in `index.coffee` and point `package.json` `main` to that file.

## RESIN-SDK

You can use the Resin SDK NodeJS module within your own plugins to communicate with Resin.

## RESIN-CLI-VISUALS

Use the Resin CLI Visuals module to make use of the widgets used by the built-in CLI commands.

# Resin CLI

Take a look at the spec for features, roadmap and progress [https://docs.google.com/a/resin.io/document/d/1mPBWy9wwLiNd25VcIvp3HEWJNjoXkALfMLMblXaGoh8/edit?usp=sharing](https://docs.google.com/a/resin.io/document/d/1mPBWy9wwLiNd25VcIvp3HEWJNjoXkALfMLMblXaGoh8/edit?usp=sharing).

## Installing

```sh
$ git clone git@bitbucket.org:rulemotion/resin-cli.git
$ cd resin-cli
$ npm install
```

### If you want to have resin on your PATH:

```sh
$ npm install -g
```

### If you want to run it locally:

```sh
$ ./bin/resin
```

Or:

```sh
$ coffee lib/app.coffee
```

## Tests

You can run the [Mocha](http://mochajs.org/) test suite, you can do:

```sh
$ gulp test
```

## Development mode

The following command will watch for any changes and will run a linter and the whole test suite:

```sh
$ gulp watch
```

## Documentation

You can renegerate the documentation with:

```sh
$ npm run-script doc
```

This should ideally be part of `gulp`, however there doesn't seems to be any plugin for the documentation generation tool that we're using at the moment ([codo](https://github.com/coffeedoc/codo)).

## Caveats

- Some interactive widgets don't work on [Cygwin](https://cygwin.com/). If you're running Windows, it's preferrable that you use `cmd.exe`.
- Most commands require an `<id>` argument, however [Commander](https://github.com/tj/commander.js) refuses to show that in the help page. This will be fixed soon.
- If you make a typo when writing a command, or run the app without any command, nothing is shown. This will be fixed soon.

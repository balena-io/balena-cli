# Resin CLI

[![dependencies](https://david-dm.org/resin-io/resin-cli.png)](https://david-dm.org/resin-io/resin-cli.png)
[![Build Status](https://travis-ci.org/resin-io/resin-cli.svg?branch=master)](https://travis-ci.org/resin-io/resin-cli)

The official Resin CLI tool.

## Installing

```sh
$ git clone git@github.com:resin-io/resin-cli.git
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
$ node build/app.js
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

If you set `DEBUG` environment variable, errors will print with a stack trace:

```sh
$ DEBUG=true resin ...
```

## Release

The following command will compile the application into a single executable for the current platform (supports Mac OS X, GNU/Linux and Windows > XP):

```sh
$ gulp release
```

The binary will be located at `build/Release`.

## Documentation

You can renegerate the documentation with:

```sh
$ npm run-script doc
```

## Manual pages

UNIX manual pages reside in `man/`

You can regenerate UNIX `roff` manual pages from markdown with:

```sh
$ gulp man
```

If you add a new `man` page, remember to add the generated filename to the `man` array in `package.json`.

## Caveats

- Some interactive widgets don't work on [Cygwin](https://cygwin.com/). If you're running Windows, it's preferrable that you use `cmd.exe`, as `Cygwin` is [not official supported by Node.js](https://github.com/chjj/blessed/issues/56#issuecomment-42671945).

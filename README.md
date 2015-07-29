# Resin CLI

[![npm version](https://badge.fury.io/js/resin-cli.svg)](http://badge.fury.io/js/resin-cli)
[![dependencies](https://david-dm.org/resin-io/resin-cli.png)](https://david-dm.org/resin-io/resin-cli.png)
[![Build Status](https://travis-ci.org/resin-io/resin-cli.svg?branch=master)](https://travis-ci.org/resin-io/resin-cli)
[![Build status](https://ci.appveyor.com/api/projects/status/45i7d0m0patxj420?svg=true)](https://ci.appveyor.com/project/jviotti/resin-cli)

The official Resin CLI tool.

## Installing

```sh
$ npm install -g resin-cli
```

### Running locally

```sh
$ ./bin/resin
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

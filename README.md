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
- Most commands require an `<id>` argument, however [Commander](https://github.com/tj/commander.js) refuses to show that in the help page. This will be fixed soon.

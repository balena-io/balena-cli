Resin CLI
=========

[![npm version](https://badge.fury.io/js/resin-cli.svg)](http://badge.fury.io/js/resin-cli)
[![dependencies](https://david-dm.org/resin-io/resin-cli.png)](https://david-dm.org/resin-io/resin-cli.png)
[![Build Status](https://travis-ci.org/resin-io/resin-cli.svg?branch=master)](https://travis-ci.org/resin-io/resin-cli)
[![Build status](https://ci.appveyor.com/api/projects/status/45i7d0m0patxj420?svg=true)](https://ci.appveyor.com/project/jviotti/resin-cli)

The official Resin CLI tool.

Requisites
----------

- [NodeJS](https://nodejs.org) (at least v0.10)
- [Git](https://git-scm.com)

Getting Started
---------------

### Installing

This might require elevated privileges in some environments.

```sh
$ npm install -g resin-cli
```

### Login

```sh
$ resin login
```

### List available commands

```sh
$ resin help
```

### Run the quickstart wizard

Run as `root` on UNIX based systems, and in an administrator command line prompt in Windows.

```sh
$ resin quickstart
```

Caveats
-------

- Some interactive widgets don't work on [Cygwin](https://cygwin.com/). If you're running Windows, it's preferrable that you use `cmd.exe`, as `Cygwin` is [not official supported by Node.js](https://github.com/chjj/blessed/issues/56#issuecomment-42671945).

Support
-------

If you're having any problem, check our [troubleshooting guide](https://github.com/resin-io/resin-cli/blob/master/TROUBLESHOOTING.md) and if your problem is not addressed there, please [raise an issue](https://github.com/resin-io/resin-cli/issues/new) on GitHub and the Resin.io team will be happy to help.

License
-------

The project is licensed under the MIT license.

resin(1) - tab completion for resin
===================================

## DESCRIPTION

It provides basic completion capabilities for `zsh` and `bash`.o

If you're using `bash`, add the following line to your `~/.bashrc`:

	. /path/to/resin/completion/resin.sh.

or create a symlink like this if you have automatic bash completion set up:

	ln - /path/to/resin/completion/resin.sh /etc/bash-completion.d/resin

or, perhaps:

	ln - /path/to/resin/completion/resin.sh /usr/local/etc/bash-completion.d/resin

If you're using `zsh`, add the following to your `~/.zshrc`:

	autoload bashcompinit
	bashcompinit
	source /path/to/resin/completion/resin.sh

## RESIN PATH

`/path/to/resin` refers to the place where resin was globally installed in your system.

This is usually something like `/usr/lib/node_modules/resin`, or `C:\Users\AppData\Roaming\npm\node_modules\resin` on Windows.

## COPYRIGHT

resin is Copyright (C) 2014 Resin.io <https://resin.io>

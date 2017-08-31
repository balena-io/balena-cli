#!/bin/sh
set -e

npm run build
echo

if ! git diff HEAD --exit-code ; then
	echo '** Uncommitted changes found after build - FAIL **'
	exit 1
elif test -n "$(git ls-files --exclude-standard --others | tee /dev/tty)" ; then
	echo '** Untracked uncommitted files found after build (^^^ listed above ^^^) - FAIL **'
	exit 2
else
	echo 'No unexpected changes after build, all good.'
fi

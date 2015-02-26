#!/bin/bash

# http://stackoverflow.com/questions/1955505/parsing-json-with-sed-and-awk
function parse_json() {
    echo $1 | sed -e 's/[{}]/''/g' | awk -F=':' -v RS=',' "\$1~/\"$2\"/ {print}" | sed -e "s/\"$2\"://" | tr -d "\n\t" | sed -e 's/\\"/"/g' | sed -e 's/\\\\/\\/g' | sed -e 's/^[ \t]*//g' | sed -e 's/^"//'  -e 's/"$//'
}

PACKAGE_JSON=`cat package.json`
VERSION=$(parse_json "$PACKAGE_JSON" version)
NAME=$(parse_json "$PACKAGE_JSON" name)

if [ -z flatten-packages ]; then
  echo "Missing flatten-packages npm module."
	echo "Install it with:"
	echo "	$ npm install -g flatten-packages"
  exit 1
fi

function print_banner() {
	local message=$1

	echo ""
	echo $message
	echo ""
}

function distribute() {
	local os=$1

	local package="$NAME-$VERSION-$os"

	print_banner "Copying necessary files"

	# Copy all needed files
	mkdir -p build/$package

	cp -rf bin build/$package

	# TODO: Omit bin/node in a better way
	rm -rf build/$package/bin/node

	cp -rf lib build/$package
	cp -rf package.json build/$package

	print_banner "Running npm install"

	cd build/$package

	RESIN_BUNDLE=$os npm install --production --force
	flatten-packages .

	cd ..

	mkdir -p distrib

	print_banner "Compression package"

	if [ "$os" == "win32" ]; then
		zip -r distrib/$package.zip $package
	else
		tar fcz distrib/$package.tar.gz $package
		tar fcj distrib/$package.tar.bz2 $package
	fi

	cd ..
}

# distribute "darwin"
# distribute "linux"
distribute "win32"
# distribute "sunos"

tree build/distrib

#!/bin/bash

# http://stackoverflow.com/questions/1955505/parsing-json-with-sed-and-awk
function parse_json() {
    echo $1 | sed -e 's/[{}]/''/g' | awk -F=':' -v RS=',' "\$1~/\"$2\"/ {print}" | sed -e "s/\"$2\"://" | tr -d "\n\t" | sed -e 's/\\"/"/g' | sed -e 's/\\\\/\\/g' | sed -e 's/^[ \t]*//g' | sed -e 's/^"//'  -e 's/"$//'
}

PACKAGE_JSON=`cat package.json`
VERSION=$(parse_json "$PACKAGE_JSON" version)
NAME=$(parse_json "$PACKAGE_JSON" name)

function print_banner() {
	local message=$1

	echo ""
	echo $message
	echo ""
}

function distribute() {
	local os=$1
	local arch=$2

	local package="$NAME-$VERSION-$os-$arch"

	print_banner "Copying necessary files"

	# Copy all needed files
	mkdir -p build/$package

	cp -vrf bin build/$package

	# TODO: Omit bin/node in a better way
	rm -vrf build/$package/bin/node

	cp -vrf lib build/$package
	cp -vrf package.json build/$package

	print_banner "Running npm install"

	cd build/$package

	RESIN_OS=$os RESIN_ARCH=$arch npm install --production --force

	# Leaving this enabled causes
	# Path too long issues in Windows.
	# npm dedupe

	cd ..

	mkdir -p distrib

	print_banner "Compression package"

	if [ "$os" == "win32" ]; then
		zip -r distrib/$package.zip $package
	else
		tar fvcz distrib/$package.tar.gz $package
		tar fvcj distrib/$package.tar.bz2 $package
	fi

	cd ..
}

# distribute "darwin" "x64"
# distribute "darwin" "x86"

# distribute "linux" "x64"
# distribute "linux" "x86"

distribute "win32" "x64"
distribute "win32" "x86"

# distribute "sunos" "x64"
# distribute "sunos" "x86"

tree build/distrib

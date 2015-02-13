#!/bin/bash

NODE_DIST_URL="http://nodejs.org/dist"
CURL="curl -#"

# http://stackoverflow.com/questions/1955505/parsing-json-with-sed-and-awk
function parse_json() {
    echo $1 | sed -e 's/[{}]/''/g' | awk -F=':' -v RS=',' "\$1~/\"$2\"/ {print}" | sed -e "s/\"$2\"://" | tr -d "\n\t" | sed -e 's/\\"/"/g' | sed -e 's/\\\\/\\/g' | sed -e 's/^[ \t]*//g' | sed -e 's/^"//'  -e 's/"$//'
}

PACKAGE_JSON=`cat package.json`
VERSION=$(parse_json "$PACKAGE_JSON" version)
NAME=$(parse_json "$PACKAGE_JSON" name)
NODE_VERSION=$(parse_json "$PACKAGE_JSON" bundled_engine)

function print_banner() {
	local message=$1

	echo ""
	echo $message
	echo ""
}

function download_node() {
	local os=$1
	local arch=$2
	local version=$3
	local output=$4

	local remote_package="node-$version-$os-$arch"
	local package="node-$os-$arch"

	print_banner "Downloading $remote_package"

	mkdir -p $output

	if [ "$os" == "win32" ]; then
		if [ "$arch" == "x86" ]; then
			$CURL $NODE_DIST_URL/$version/node.exe -o $output/$package.exe
		else
			$CURL $NODE_DIST_URL/$version/$arch/node.exe -o $output/$package.exe
		fi
	else
		$CURL $NODE_DIST_URL/$version/$remote_package.tar.gz | tar xz -C $output/
		cp $output/$remote_package/bin/node $output/$package.bin
		rm -rf $output/$remote_package
	fi
}

function distribute() {
	local os=$1
	local arch=$2

	local package="$NAME-$VERSION-$os-$arch"

	print_banner "Copying necessary files"

	# Copy all needed files
	mkdir -p build/$package
	cp -vrf bin build/$package
	cp -vrf lib build/$package
	cp -vrf package.json build/$package

	node ./node_modules/node-binary/bin/cli.js download $NODE_VERSION build/$package/bin/node --arch $arch --os $os

	print_banner "Running npm install"

	cd build/$package
	npm install --production --force

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

distribute "darwin" "x64"
# distribute "darwin" "x86"

# distribute "linux" "x64"
# distribute "linux" "x86"

# distribute "win32" "x64"
# distribute "win32" "x86"

# distribute "sunos" "x64"
# distribute "sunos" "x86"

tree build/distrib

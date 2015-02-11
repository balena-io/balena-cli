#!/bin/bash

# Example:
#		$ ./download_node darwin x64 v0.12.0 ../bin/node

OS=$1
ARCH=$2
NODE_VERSION=$3
OUTPUT=$4

if [ -z $OS ] || [ -z $ARCH ] || [ -z $NODE_VERSION ] || [ -z $OUTPUT ]; then
  echo "Usage: $0 <os> <arch> <node_version> <output>"
  exit 1
fi

NODE_DIST_URL="http://nodejs.org/dist"
CURL="curl -#"
PACKAGE="node-$NODE_VERSION-$OS-$ARCH"

echo ""
echo "Downloading $PACKAGE"
echo ""

mkdir -p $OUTPUT

if [ "$OS" == "win32" ]; then
	if [ "$arch" == "x86" ]; then
		$CURL $NODE_DIST_URL/$NODE_VERSION/node.exe -o $OUTPUT/$PACKAGE.exe
	else
		$CURL $NODE_DIST_URL/$NODE_VERSION/$ARCH/node.exe -o $OUTPUT/$PACKAGE.exe
	fi
else
	$CURL $NODE_DIST_URL/$NODE_VERSION/$PACKAGE.tar.gz | tar xz -C $OUTPUT/
	cp $OUTPUT/$PACKAGE/bin/node $OUTPUT/$PACKAGE.bin
	rm -rf $OUTPUT/$PACKAGE
fi

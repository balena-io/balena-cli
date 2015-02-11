#!/bin/bash

# Example:
#		$ ./download_npm v2.5.1 ./bin/npm

NPM_VERSION=$1
OUTPUT=$2

if [ -z $NPM_VERSION ] || [ -z $OUTPUT ]; then
  echo "Usage: $0 <npm_version> <output_directory>"
  exit 1
fi

echo ""
echo "Downloading npm@$NPM_VERSION"
echo ""

mkdir -p $OUTPUT

# http://stackoverflow.com/questions/11497457/git-clone-without-git-directory
git clone --depth=1 --branch $NPM_VERSION --single-branch git@github.com:npm/npm.git $OUTPUT
rm -rf $OUTPUT/.git

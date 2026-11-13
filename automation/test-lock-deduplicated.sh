#!/bin/bash

set -e

# Renovate dedupes with the same min-release-age, so an npm that ignores it resolves a different tree.
min_release_age=$(npm config get min-release-age)
if [ "$min_release_age" != 3 ]; then
  echo "** npm $(npm --version) has min-release-age=$min_release_age, expected 3 from .npmrc (needs npm >= 11.10.0) - FAIL **"
  exit 1
fi

cp npm-shrinkwrap.json npm-shrinkwrap.json.old
npm i
npm dedupe
npm i

if ! diff -q npm-shrinkwrap.json npm-shrinkwrap.json.old > /dev/null; then
  rm npm-shrinkwrap.json.old
  echo "** npm-shrinkwrap.json was not deduplicated or not fully committed - FAIL **";
  echo "** This can usually be fixed with: **";
  echo "** git checkout master -- npm-shrinkwrap.json **";
  echo "** rm -rf node_modules **";
  echo "** npm install && npm dedupe && npm install **";
  exit 1;
fi

rm npm-shrinkwrap.json.old

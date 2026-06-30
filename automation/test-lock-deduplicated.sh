#!/bin/bash

set -e

# Install safe-chain if not present
if ! command -v safe-chain &> /dev/null; then
  npm install -g safe-chain
fi

cp npm-shrinkwrap.json npm-shrinkwrap.json.old
safe-chain npm i
safe-chain npm dedupe
safe-chain npm i

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
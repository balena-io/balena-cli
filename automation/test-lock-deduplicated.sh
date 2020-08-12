#!/bin/bash

set -e

cp npm-shrinkwrap.json npm-shrinkwrap.json.old
npm i
npm dedupe
npm i

if ! diff -q npm-shrinkwrap.json npm-shrinkwrap.json.old > /dev/null; then
  rm npm-shrinkwrap.json.old
  echo "** npm-shrinkwrap.json was not deduplicated or not fully committed - FAIL **";
  echo "** Please run 'npm ci', followed by 'npm dedupe' **";
  exit 1;
fi

rm npm-shrinkwrap.json.old

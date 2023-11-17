#!/bin/bash

set -e

if npm dedupe --dry-run | grep "remove"; then
  cp npm-shrinkwrap.json npm-shrinkwrap.json.old
  npm dedupe
  diff npm-shrinkwrap.json.old npm-shrinkwrap.json;
  rm npm-shrinkwrap.json.old
  echo "** npm-shrinkwrap.json was not deduplicated or not fully committed - FAIL **";
  echo "** Please run 'npm ci', followed by 'npm dedupe' **";
  exit 1;
fi
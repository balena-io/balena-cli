#!/bin/sh
i=1; while :; do echo "basic test ($i) $(uname -a)"; sleep 5; i=$((i+1)); done

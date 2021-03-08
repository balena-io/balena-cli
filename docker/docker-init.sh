#!/bin/bash

# start dockerd if env var is set
if [ "${DOCKERD}" = "1" ]
then
    [ -e /var/run/docker.sock ] && rm /var/run/docker.sock
    dockerd &
fi

# load private ssh key if one is provided
if [ -n "${SSH_PRIVATE_KEY}" ]
then
    # if an ssh agent socket was not provided, start our own agent
    [ -e "${SSH_AUTH_SOCK}" ] || eval "$(ssh-agent -s)"
    echo "${SSH_PRIVATE_KEY}" | tr -d '\r' | ssh-add -
fi

# space-separated list of balena CLI commands (filled in through `sed`
# in a Dockerfile RUN instruction)
CLI_CMDS="help"

# treat the provided command as a balena CLI arg...
# 1. if the first word matches a known entry in CLI_CMDS
# 2. OR if the first character is a hyphen (eg. -h or --debug)
if [[ " ${CLI_CMDS} " =~ " ${1} " ]] || [ "${1:0:1}" = "-" ]
then
    exec balena "$@"
else
    exec "$@"
fi

#!/bin/bash

_balena_complete()
{
  local cur prev

  # Valid top-level completions
  commands="app apps build config deploy device devices env envs help key \
            keys local login logout logs note os preload quickstart settings \
            scan ssh util version whoami"
  # Sub-completions
  app_cmds="create restart rm"
  config_cmds="generate inject read reconfigure write"
  device_cmds="identify init move public-url reboot register rename rm \
               shutdown"
  device_public_url_cmds="disable enable status"
  env_cmds="add rename rm"
  key_cmds="add rm"
  local_cmds="configure flash"
  os_cmds="build-config configure download initialize versions"
  util_cmds="available-drives"


  COMPREPLY=()
  cur=${COMP_WORDS[COMP_CWORD]}
  prev=${COMP_WORDS[COMP_CWORD-1]}

  if [ $COMP_CWORD -eq 1 ]
  then
    COMPREPLY=( $(compgen -W "${commands}" -- $cur) )
  elif [ $COMP_CWORD -eq 2 ]
  then
    case "$prev" in
      "app")
        COMPREPLY=( $(compgen -W "$app_cmds" -- $cur) )
        ;;
      "config")
        COMPREPLY=( $(compgen -W "$config_cmds" -- $cur) )
        ;;
      "device")
        COMPREPLY=( $(compgen -W "$device_cmds" -- $cur) )
        ;;
      "env")
        COMPREPLY=( $(compgen -W "$env_cmds" -- $cur) )
        ;;
      "key")
        COMPREPLY=( $(compgen -W "$key_cmds" -- $cur) )
        ;;
      "local")
        COMPREPLY=( $(compgen -W "$local_cmds" -- $cur) )
        ;;
      "os")
        COMPREPLY=( $(compgen -W "$os_cmds" -- $cur) )
        ;;
      "util")
        COMPREPLY=( $(compgen -W "$util_cmds" -- $cur) )
        ;;
      "*")
        ;;
    esac
  elif [ $COMP_CWORD -eq 3 ]
  then
    case "$prev" in
      "public-url")
        COMPREPLY=( $(compgen -W "$device_public_url_cmds" -- $cur) )
        ;;
      "*")
        ;;
    esac
  fi

}
complete -F _balena_complete balena

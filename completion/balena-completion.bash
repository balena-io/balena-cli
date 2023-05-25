#!/bin/bash

#GENERATED FILE DON'T MODIFY#

_balena_complete()
{
  local cur prev

  # Valid top-level completions
  main_commands="build deploy envs fleets join keys leave login logout logs note orgs preload push releases scan settings ssh support tags tunnel version whoami api-key api-keys app config device device devices env fleet fleet internal key key local os release release tag util"
  # Sub-completions
  api_key_cmds="generate"
  app_cmds="create"
  config_cmds="generate inject read reconfigure write"
  device_cmds="deactivate identify init local-mode move os-update pin public-url purge reboot register rename restart rm shutdown track-fleet"
  devices_cmds="supported"
  env_cmds="add rename rm"
  fleet_cmds="create pin purge rename restart rm track-latest"
  internal_cmds="osinit"
  key_cmds="add rm"
  local_cmds="configure flash"
  os_cmds="build-config configure download initialize versions"
  release_cmds="finalize invalidate validate"
  tag_cmds="rm set"



  COMPREPLY=()
  cur=${COMP_WORDS[COMP_CWORD]}
  prev=${COMP_WORDS[COMP_CWORD-1]}

  if [ $COMP_CWORD -eq 1 ]
  then
    COMPREPLY=( $(compgen -W "${main_commands}" -- $cur) )
  elif [ $COMP_CWORD -eq 2 ]
  then
    case "$prev" in
      api-key)
        COMPREPLY=( $(compgen -W "$api_key_cmds" -- $cur) )
        ;;
      app)
        COMPREPLY=( $(compgen -W "$app_cmds" -- $cur) )
        ;;
      config)
        COMPREPLY=( $(compgen -W "$config_cmds" -- $cur) )
        ;;
      device)
        COMPREPLY=( $(compgen -W "$device_cmds" -- $cur) )
        ;;
      devices)
        COMPREPLY=( $(compgen -W "$devices_cmds" -- $cur) )
        ;;
      env)
        COMPREPLY=( $(compgen -W "$env_cmds" -- $cur) )
        ;;
      fleet)
        COMPREPLY=( $(compgen -W "$fleet_cmds" -- $cur) )
        ;;
      internal)
        COMPREPLY=( $(compgen -W "$internal_cmds" -- $cur) )
        ;;
      key)
        COMPREPLY=( $(compgen -W "$key_cmds" -- $cur) )
        ;;
      local)
        COMPREPLY=( $(compgen -W "$local_cmds" -- $cur) )
        ;;
      os)
        COMPREPLY=( $(compgen -W "$os_cmds" -- $cur) )
        ;;
      release)
        COMPREPLY=( $(compgen -W "$release_cmds" -- $cur) )
        ;;
      tag)
        COMPREPLY=( $(compgen -W "$tag_cmds" -- $cur) )
        ;;

      "*")
        ;;
    esac
  fi

}
complete -F _balena_complete balena

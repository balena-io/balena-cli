#!/bin/bash

#GENERATED FILE DON'T MODIFY#

_balena_complete()
{
  local cur prev

  # Valid top-level completions
  main_commands="api-key api-keys app auth block config deploy deploy device device devices env envs fleet fleet fleets internal key key keys local logs network notes orgs os platform preload push release release releases settings support tag tags util version"
  # Sub-completions
  api_key_cmds="generate revoke"
  app_cmds="create"
  auth_cmds="login logout whoami"
  block_cmds="create"
  config_cmds="generate inject read reconfigure write"
  deploy_cmds="build"
  device_cmds="deactivate identify init local-mode move os-update pin public-url purge reboot register rename restart rm shutdown start-service stop-service track-fleet"
  devices_cmds="supported"
  env_cmds="add rename rm"
  fleet_cmds="create pin purge rename restart rm track-latest"
  internal_cmds="osinit"
  key_cmds="add rm"
  local_cmds="configure flash"
  network_cmds="scan ssh tunnel"
  os_cmds="build-config configure download initialize versions"
  platform_cmds="join leave"
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
      auth)
        COMPREPLY=( $(compgen -W "$auth_cmds" -- $cur) )
        ;;
      block)
        COMPREPLY=( $(compgen -W "$block_cmds" -- $cur) )
        ;;
      config)
        COMPREPLY=( $(compgen -W "$config_cmds" -- $cur) )
        ;;
      deploy)
        COMPREPLY=( $(compgen -W "$deploy_cmds" -- $cur) )
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
      network)
        COMPREPLY=( $(compgen -W "$network_cmds" -- $cur) )
        ;;
      os)
        COMPREPLY=( $(compgen -W "$os_cmds" -- $cur) )
        ;;
      platform)
        COMPREPLY=( $(compgen -W "$platform_cmds" -- $cur) )
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

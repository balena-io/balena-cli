#!/bin/bash

#GENERATED FILE DON'T MODIFY#

_balena_complete()
{
  local cur prev

  # Valid top-level completions
  main_commands="api-key app block build config deploy device device-type env fleet internal join leave local login logout organization os preload push release release-asset settings ssh-key support tag util whoami"
  # Sub-completions
  api_key_cmds="generate list revoke"
  app_cmds="create"
  block_cmds="create"
  config_cmds="generate inject read reconfigure write"
  device_type_cmds="list"
  device_cmds="deactivate detect identify init list local-mode logs move note os-update pin public-url purge reboot register rename restart rm shutdown ssh start-service stop-service track-fleet tunnel"
  env_cmds="list rename rm set"
  fleet_cmds="create list pin purge rename restart rm track-latest"
  internal_cmds="osinit"
  local_cmds="configure flash"
  organization_cmds="list"
  os_cmds="configure download initialize versions"
  release_asset_cmds="delete download list upload"
  release_cmds="finalize invalidate list validate"
  ssh_key_cmds="add list rm"
  tag_cmds="list rm set"



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
      block)
        COMPREPLY=( $(compgen -W "$block_cmds" -- $cur) )
        ;;
      config)
        COMPREPLY=( $(compgen -W "$config_cmds" -- $cur) )
        ;;
      device-type)
        COMPREPLY=( $(compgen -W "$device_type_cmds" -- $cur) )
        ;;
      device)
        COMPREPLY=( $(compgen -W "$device_cmds" -- $cur) )
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
      local)
        COMPREPLY=( $(compgen -W "$local_cmds" -- $cur) )
        ;;
      organization)
        COMPREPLY=( $(compgen -W "$organization_cmds" -- $cur) )
        ;;
      os)
        COMPREPLY=( $(compgen -W "$os_cmds" -- $cur) )
        ;;
      release-asset)
        COMPREPLY=( $(compgen -W "$release_asset_cmds" -- $cur) )
        ;;
      release)
        COMPREPLY=( $(compgen -W "$release_cmds" -- $cur) )
        ;;
      ssh-key)
        COMPREPLY=( $(compgen -W "$ssh_key_cmds" -- $cur) )
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

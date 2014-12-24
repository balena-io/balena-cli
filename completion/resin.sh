_resin() {
	COMPREPLY=()

	local current="${COMP_WORDS[COMP_CWORD]}"
	local previous="${COMP_WORDS[COMP_CWORD-1]}"
	local options="app device key envs os example"

	case "${previous}" in
		app)
			local subcommands="create rm restart"
			COMPREPLY=( $(compgen -W "${subcommands}" -- ${current}) )
			return 0 ;;
		device)
			local subcommands="rename rm identify"
			COMPREPLY=( $(compgen -W "${subcommands}" -- ${current}) )
			return 0 ;;
		key)
			local subcommands="add rm"
			COMPREPLY=( $(compgen -W "${subcommands}" -- ${current}) )
			return 0 ;;
		envs)
			local subcommands="add rename rm"
			COMPREPLY=( $(compgen -W "${subcommands}" -- ${current}) )
			return 0 ;;
		os)
			local subcommands="download"
			COMPREPLY=( $(compgen -W "${subcommands}" -- ${current}) )
			return 0 ;;
		example)
			local subcommands="clone"
			COMPREPLY=( $(compgen -W "${subcommands}" -- ${current}) )
			return 0 ;;
		*)
			;;
	esac

	COMPREPLY=( $(compgen -W "${options}" -- ${current}) )
	return 0
}

complete -F _resin resin

declare module 'balena-sync' {
	import { CommandDefinition } from 'capitano';

	export function capitano(tool: 'balena-cli'): CommandDefinition;
}

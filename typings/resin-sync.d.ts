declare module 'resin-sync' {
	import { CommandDefinition } from 'capitano';

	export function capitano(tool: 'resin-cli'): CommandDefinition;
}

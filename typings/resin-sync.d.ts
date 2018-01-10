declare module 'resin-sync' {
	import { CommandDefinition } from 'capitano';

	export function capitano(tool: 'resin-cli'): CommandDefinition;

	export const forms: {
		selectSyncDestination(preferredDestination: string): Promise<string>;
		selectLocalResinOsDevice(timeout?: number): Promise<string>;
	};
}

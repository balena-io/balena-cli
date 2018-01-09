declare module 'drivelist' {
	interface Drive {
		device: string;
		displayName: string;
		description: string;
		size: number;
		mountpoints: Array<{
			path: string;
		}>;
		raw: string;
		protected: boolean;
		system: boolean;
	}

	export function list(
		callback: (e: Error | null, drives: Drive[]) => void,
	): void;
}

declare module 'dockerfile-template' {
	/**
	 * Variables which define what will be replaced, and what they will be replaced with.
	 */
	export interface TemplateVariables {
		[key: string]: string;
	}

	export function process(
		content: string,
		variables: TemplateVariables,
	): string;
}

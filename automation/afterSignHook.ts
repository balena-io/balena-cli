import { notarize } from 'electron-notarize';

export async function sign(filePath: string): Promise<void> {
	const appleId = 'accounts+apple@balena.io';

	await notarize({
		appBundleId: 'io.balena.etcher',
		appPath: filePath,
		appleId,
		appleIdPassword: '@keychain:CLI_PASSWORD',
	});
}

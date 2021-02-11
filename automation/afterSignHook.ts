import { notarize } from 'electron-notarize'
const { ELECTRON_SKIP_NOTARIZATION } = process.env

export async function sign (filePath: string): Promise<void> {
  const appleId = 'accounts+apple@balena.io'

  await notarize({
    appBundleId: 'io.balena.etcher',
    appPath: filePath,
    appleId,
    appleIdPassword: '@keychain:CLI_PASSWORD'
  })
}

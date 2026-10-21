#!/usr/bin/env node

// We boost the threadpool size as ext2fs can deadlock with some
// operations otherwise, if the pool runs out.
process.env.UV_THREADPOOL_SIZE = '64';

// Disable oclif registering ts-node
process.env.OCLIF_TS_NODE = '0';

const shouldApplySystemCertificates = 
	!process.env.NODE_OPTIONS.includes('--use-bundled-ca') &&
	!process.env.NODE_OPTIONS.includes('--use-openssl-ca') &&
	process.env.BALENA_NO_CA_OVERRIDE !== '1';

if (shouldApplySystemCertificates) {
	process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --use-openssl-ca`.trim();

	const { spawnSync } = require('child_process');
	const result = spawnSync(process.argv[0], process.argv.slice(1), {
		stdio: 'inherit',
		env: {
			...process.env,
		},
	});

	process.exit(result.status ?? 0);
}

async function run() {
	// Use fast-boot to cache require lookups, speeding up startup
	await require('../build/fast-boot').start();

	// Set the desired es version for downstream modules that support it
	require('@balena/es-version').set('es2018');

	// Run the CLI
	await require('../build/app').run(undefined, { dir: __dirname });
}

void run();

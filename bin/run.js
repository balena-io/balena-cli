#!/usr/bin/env node

// We boost the threadpool size as ext2fs can deadlock with some
// operations otherwise, if the pool runs out.
process.env.UV_THREADPOOL_SIZE = '64';

// Disable oclif registering ts-node
process.env.OCLIF_TS_NODE = '0';

async function run() {
	// Use fast-boot to cache require lookups, speeding up startup
	const fastBoot = await import('../build/fast-boot.js');
	await fastBoot.start();

	// Set the desired es version for downstream modules that support it
	const esVersion = await import('@balena/es-version');
	esVersion.set('es2018');

	// Run the CLI
	const app = await import('../build/app.js');
	await app.run(undefined, { dir: import.meta.dirname });
}

void run();

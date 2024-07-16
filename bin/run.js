#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

// We boost the threadpool size as ext2fs can deadlock with some
// operations otherwise, if the pool runs out.
process.env.UV_THREADPOOL_SIZE = '64';

async function run() {
	// Use fast-boot to cache require lookups, speeding up startup
	await (await import('../build/lib/fast-boot.js')).start();

	// Set the desired es version for downstream modules that support it
	(await import('@balena/es-version')).set('es2018');

	// Run the CLI
	await (
		await import('../build/lib/app.js')
	).run(undefined, { dir: import.meta.url });
}

run();

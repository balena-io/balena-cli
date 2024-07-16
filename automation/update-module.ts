import { exec } from 'child_process';
import * as semver from 'semver';

const changeTypes = ['major', 'minor', 'patch'] as const;

const validateChangeType = (maybeChangeType: string = 'minor') => {
	maybeChangeType = maybeChangeType.toLowerCase();
	switch (maybeChangeType) {
		case 'patch':
		case 'minor':
		case 'major':
			return maybeChangeType;
		default:
			throw new Error(`Invalid change type: '${maybeChangeType}'`);
	}
};

const compareSemverChangeType = (oldVersion: string, newVersion: string) => {
	const oldSemver = semver.parse(oldVersion)!;
	const newSemver = semver.parse(newVersion)!;

	for (const changeType of changeTypes) {
		if (oldSemver[changeType] !== newSemver[changeType]) {
			return changeType;
		}
	}
};

const run = async (cmd: string) => {
	console.info(`Running '${cmd}'`);
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		const p = exec(cmd, { encoding: 'utf8' }, (err, stdout, stderr) => {
			if (err) {
				reject(err);
				return;
			}
			resolve({ stdout, stderr });
		});
		p.stdout?.pipe(process.stdout);
		p.stderr?.pipe(process.stderr);
	});
};

const getVersion = async (module: string): Promise<string> => {
	const { stdout } = await run(`npm ls --json --depth 0 ${module}`);
	return JSON.parse(stdout).dependencies[module].version;
};

interface Upstream {
	repo: string;
	url: string;
	module?: string;
}

const getUpstreams = async () => {
	const fs = await import('fs');
	const repoYaml = fs.readFileSync(
		import.meta.dirname + '/../repo.yml',
		'utf8',
	);

	const yaml = await import('js-yaml');
	const { upstream } = yaml.load(repoYaml) as {
		upstream: Upstream[];
	};

	return upstream;
};

const getUsage = (upstreams: Upstream[], upstreamName: string) => `
Usage: npm run update ${upstreamName} $version [$changeType=minor]

Upstream names: ${upstreams.map(({ repo }) => repo).join(', ')}
`;

async function $main() {
	const upstreams = await getUpstreams();

	if (process.argv.length < 3) {
		throw new Error(getUsage(upstreams, '$upstreamName'));
	}

	const upstreamName = process.argv[2];

	const upstream = upstreams.find((v) => v.repo === upstreamName);

	if (!upstream) {
		throw new Error(
			`Invalid upstream name '${upstreamName}', valid options: ${upstreams
				.map(({ repo }) => repo)
				.join(', ')}`,
		);
	}

	if (process.argv.length < 4) {
		throw new Error(getUsage(upstreams, upstreamName));
	}

	const packageName = upstream.module || upstream.repo;

	const oldVersion = await getVersion(packageName);
	await run(`npm install ${packageName}@${process.argv[3]}`);
	const newVersion = await getVersion(packageName);
	if (newVersion === oldVersion) {
		throw new Error(`Already on version '${newVersion}'`);
	}

	console.log(`Updated ${upstreamName} from ${oldVersion} to ${newVersion}`);
	const semverChangeType = compareSemverChangeType(oldVersion, newVersion);

	const changeType = process.argv[4]
		? // if the caller specified a change type, use that one
			validateChangeType(process.argv[4])
		: // use the same change type as in the dependency, but avoid major bumps
			semverChangeType && semverChangeType !== 'major'
			? semverChangeType
			: 'minor';
	console.log(`Using Change-type: ${changeType}`);

	let { stdout: currentBranch } = await run('git rev-parse --abbrev-ref HEAD');
	currentBranch = currentBranch.trim();
	console.log(`Currenty on branch: '${currentBranch}'`);
	if (currentBranch === 'master') {
		await run(`git checkout -b "update-${upstreamName}-${newVersion}"`);
	}

	await run(`git add package.json npm-shrinkwrap.json`);
	await run(
		`git commit --message "Update ${upstreamName} to ${newVersion}" --message "Update ${upstreamName} from ${oldVersion} to ${newVersion}" --message "Change-type: ${changeType}"`,
	);
}

async function main() {
	try {
		await $main();
	} catch (e) {
		console.error(e);
		process.exitCode = 1;
	}
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

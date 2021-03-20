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
			console.error(`Invalid change type: '${maybeChangeType}'`);
			return process.exit(1);
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
		p.stdout.pipe(process.stdout);
		p.stderr.pipe(process.stderr);
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
	const repoYaml = fs.readFileSync(__dirname + '/../repo.yml', 'utf8');

	const yaml = await import('js-yaml');
	const { upstream } = yaml.load(repoYaml) as {
		upstream: Upstream[];
	};

	return upstream;
};

const printUsage = (upstreams: Upstream[], upstreamName: string) => {
	console.error(
		`
Usage: npm run update ${upstreamName} $version [$changeType=minor]

Upstream names: ${upstreams.map(({ repo }) => repo).join(', ')}
`,
	);
	return process.exit(1);
};

// TODO: Drop the wrapper function once we move to TS 3.8,
// which will support top level await.
async function main() {
	const upstreams = await getUpstreams();

	if (process.argv.length < 3) {
		return printUsage(upstreams, '$upstreamName');
	}

	const upstreamName = process.argv[2];

	const upstream = upstreams.find((v) => v.repo === upstreamName);

	if (!upstream) {
		console.error(
			`Invalid upstream name '${upstreamName}', valid options: ${upstreams
				.map(({ repo }) => repo)
				.join(', ')}`,
		);
		return process.exit(1);
	}

	if (process.argv.length < 4) {
		printUsage(upstreams, upstreamName);
	}

	const packageName = upstream.module || upstream.repo;

	const oldVersion = await getVersion(packageName);
	await run(`npm install ${packageName}@${process.argv[3]}`);
	const newVersion = await getVersion(packageName);
	if (newVersion === oldVersion) {
		console.error(`Already on version '${newVersion}'`);
		return process.exit(1);
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

main();

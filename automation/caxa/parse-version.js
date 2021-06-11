const { promises: fs } = require('fs');

async function parseVersion() {
	const fields = ['head_branch', 'base_org', 'base_repo', 'componentVersion'];
	const ver = JSON.parse(await fs.readFile('.git/.version'));
	console.log(fields.map((f) => ver[f]).join(' '));
}

parseVersion();

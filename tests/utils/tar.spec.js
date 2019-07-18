const { expect } = require('chai');
const _ = require('lodash');
const path = require('path');
const tar = require('tar-stream');

const { tarDirectory } = require('../../build/utils/compose');

describe('compare new and old tarDirectory implementations', function() {
	const preFinalizeCallback = pack => {
		pack.entry({ name: 'extra.txt' }, 'extra');
	};

	it('should produce a compatible tar stream', async function() {
		const oldTarPack = await tarDirectory(
			path.join('tests', 'test-files', 'tar1'),
			preFinalizeCallback,
			false,
		);
		const oldFileList = await getTarPackFileList(oldTarPack);

		const newTarPack = await tarDirectory(
			path.join('tests', 'test-files', 'tar1'),
			preFinalizeCallback,
			true,
		);
		const newFileList = await getTarPackFileList(newTarPack);

		const gitIgnored = ['a.txt', 'src/src-a.txt'];
		expect(newFileList.sort()).to.have.members(
			[...oldFileList, ...gitIgnored].sort(),
		);
		expect(newFileList).to.include.members(['.balena/balena.yml']);
	});
});

async function getTarPackFileList(pack) {
	const { drainStream } = require('tar-utils');
	const fileList = [];
	const extract = tar.extract();

	return await new Promise((resolve, reject) => {
		extract
			.on('error', reject)
			.on('entry', async function(header, stream, next) {
				fileList.push(header.name);
				await drainStream(stream);
				next();
			})
			.on('finish', function() {
				resolve(fileList);
			});
		pack.pipe(extract);
	});
}

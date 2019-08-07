const chai = require('chai');
const _ = require('lodash');
const path = require('path');

let { expect } = chai;

const { FileIgnorer, IgnoreFileType } = require('../../build/utils/ignore');

describe('File ignorer', function() {

	it('should detect ignore files', function() {
		let f = new FileIgnorer(`.${path.sep}`);
		expect(f.getIgnoreFileType('.gitignore')).to.equal(IgnoreFileType.GitIgnore);
		expect(f.getIgnoreFileType('.dockerignore')).to.equal(IgnoreFileType.DockerIgnore);
		expect(f.getIgnoreFileType('./.gitignore')).to.equal(IgnoreFileType.GitIgnore);
		expect(f.getIgnoreFileType('./.dockerignore')).to.equal(IgnoreFileType.DockerIgnore);

		// gitignore files can appear in subdirectories, but dockerignore files cannot
		expect(f.getIgnoreFileType('./subdir/.gitignore')).to.equal(IgnoreFileType.GitIgnore);
		expect(f.getIgnoreFileType('./subdir/.dockerignore')).to.equal(null);
		expect(f.getIgnoreFileType('./subdir/subdir2/.gitignore')).to.equal(IgnoreFileType.GitIgnore);

		expect(f.getIgnoreFileType('file')).to.equal(null);
		return expect(f.getIgnoreFileType('./file')).to.equal(null);
	});

	it('should filter files from the root directory', function() {

		let ignore = new FileIgnorer(`.${path.sep}`);
		ignore.gitIgnoreEntries = [
			{ pattern: '*.ignore', filePath: '.gitignore' }
		];
		ignore.dockerIgnoreEntries = [
			{ pattern: '*.ignore2', filePath: '.dockerignore' }
		];
		let files = [
			'a',
			'a/b',
			'a/b/c',
			'file.ignore',
			'file2.ignore',
			'file.ignore2',
			'file2.ignore'
		];

		return expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'a',
			'a/b',
			'a/b/c'
		]);
	});

	return it('should filter files from subdirectories', function() {

		let ignore = new FileIgnorer(`.${path.sep}`);
		ignore.gitIgnoreEntries = [
			{ pattern: '*.ignore', filePath: 'lib/.gitignore' }
		];
		let files = [
			'test.ignore',
			'root.ignore',
			'lib/normal-file',
			'lib/should.ignore',
			'lib/thistoo.ignore'
		];
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'test.ignore',
			'root.ignore',
			'lib/normal-file'
		]);

		ignore.gitIgnoreEntries = [
			{ pattern: '*.ignore', filePath: './lib/.gitignore' }
		];
		files = [
			'test.ignore',
			'root.ignore',
			'lib/normal-file',
			'lib/should.ignore',
			'lib/thistoo.ignore'
		];
		return expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'test.ignore',
			'root.ignore',
			'lib/normal-file'
		]);
	});
});

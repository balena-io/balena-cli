import { expect } from 'chai';
import * as _ from 'lodash';
import * as path from 'path';
import { FileIgnorer, IgnoreFileType } from '../../build/utils/ignore';

// Note that brack notation is used intentionally when accessing private members
// of the FileIgnorer class to prevent a Typescript compilation error (this
// behavior is by design: see
// https://github.com/microsoft/TypeScript/issues/19335 )
describe('File ignorer', function () {
	it('should detect ignore files', function () {
		const f = new FileIgnorer(`.${path.sep}`);
		expect(f.getIgnoreFileType('.gitignore')).to.equal(
			IgnoreFileType.GitIgnore,
		);
		expect(f.getIgnoreFileType('.dockerignore')).to.equal(
			IgnoreFileType.DockerIgnore,
		);
		expect(f.getIgnoreFileType('./.gitignore')).to.equal(
			IgnoreFileType.GitIgnore,
		);
		expect(f.getIgnoreFileType('./.dockerignore')).to.equal(
			IgnoreFileType.DockerIgnore,
		);

		// gitignore files can appear in subdirectories, but dockerignore files cannot
		expect(f.getIgnoreFileType('./subdir/.gitignore')).to.equal(
			IgnoreFileType.GitIgnore,
		);
		expect(f.getIgnoreFileType('./subdir/.dockerignore')).to.equal(null);
		expect(f.getIgnoreFileType('./subdir/subdir2/.gitignore')).to.equal(
			IgnoreFileType.GitIgnore,
		);

		expect(f.getIgnoreFileType('file')).to.equal(null);
		return expect(f.getIgnoreFileType('./file')).to.equal(null);
	});

	it('should filter files from the root directory', function () {
		const ignore = new FileIgnorer(`.${path.sep}`);
		ignore['gitIgnoreEntries'] = [
			{ pattern: '*.ignore', filePath: '.gitignore' },
		];
		ignore['dockerIgnoreEntries'] = [
			{ pattern: '*.ignore2', filePath: '.dockerignore' },
		];
		const files = [
			'a',
			'a/b',
			'a/b/c',
			'file.ignore',
			'file2.ignore',
			'file.ignore2',
			'file2.ignore',
		];

		return expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'a',
			'a/b',
			'a/b/c',
		]);
	});

	return it('should filter files from subdirectories', function () {
		const ignore = new FileIgnorer(`.${path.sep}`);
		ignore['gitIgnoreEntries'] = [
			{ pattern: '*.ignore', filePath: 'lib/.gitignore' },
		];
		let files = [
			'test.ignore',
			'root.ignore',
			'lib/normal-file',
			'lib/should.ignore',
			'lib/thistoo.ignore',
		];
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'test.ignore',
			'root.ignore',
			'lib/normal-file',
		]);

		ignore['gitIgnoreEntries'] = [
			{ pattern: '*.ignore', filePath: './lib/.gitignore' },
		];
		files = [
			'test.ignore',
			'root.ignore',
			'lib/normal-file',
			'lib/should.ignore',
			'lib/thistoo.ignore',
		];
		return expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'test.ignore',
			'root.ignore',
			'lib/normal-file',
		]);
	});
});

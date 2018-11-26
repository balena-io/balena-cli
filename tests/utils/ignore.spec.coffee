require 'mocha'
chai = require 'chai'
_ = require 'lodash'
path = require('path')

expect = chai.expect

{ FileIgnorer, IgnoreFileType } = require '../../build/utils/ignore'

describe 'File ignorer', ->

	it 'should detect ignore files', ->
		f = new FileIgnorer('.' + path.sep)
		expect(f.getIgnoreFileType('.gitignore')).to.equal(IgnoreFileType.GitIgnore)
		expect(f.getIgnoreFileType('.dockerignore')).to.equal(IgnoreFileType.DockerIgnore)
		expect(f.getIgnoreFileType('./.gitignore')).to.equal(IgnoreFileType.GitIgnore)
		expect(f.getIgnoreFileType('./.dockerignore')).to.equal(IgnoreFileType.DockerIgnore)

		# gitignore files can appear in subdirectories, but dockerignore files cannot
		expect(f.getIgnoreFileType('./subdir/.gitignore')).to.equal(IgnoreFileType.GitIgnore)
		expect(f.getIgnoreFileType('./subdir/.dockerignore')).to.equal(null)
		expect(f.getIgnoreFileType('./subdir/subdir2/.gitignore')).to.equal(IgnoreFileType.GitIgnore)

		expect(f.getIgnoreFileType('file')).to.equal(null)
		expect(f.getIgnoreFileType('./file')).to.equal(null)

	it 'should filter files from the root directory', ->

		ignore = new FileIgnorer('.' + path.sep)
		ignore.gitIgnoreEntries = [
			{ pattern: '*.ignore', filePath: '.gitignore' }
		]
		ignore.dockerIgnoreEntries = [
			{ pattern: '*.ignore2', filePath: '.dockerignore' }
		]
		files = [
			'a'
			'a/b'
			'a/b/c'
			'file.ignore'
			'file2.ignore'
			'file.ignore2'
			'file2.ignore'
		]

		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'a'
			'a/b'
			'a/b/c'
		])

	it 'should filter files from subdirectories', ->

		ignore = new FileIgnorer('.' + path.sep)
		ignore.gitIgnoreEntries = [
			{ pattern: '*.ignore', filePath: 'lib/.gitignore' }
		]
		files = [
			'test.ignore'
			'root.ignore'
			'lib/normal-file'
			'lib/should.ignore'
			'lib/thistoo.ignore'
		]
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'test.ignore'
			'root.ignore'
			'lib/normal-file'
		])

		ignore.gitIgnoreEntries = [
			{ pattern: '*.ignore', filePath: './lib/.gitignore' }
		]
		files = [
			'test.ignore'
			'root.ignore'
			'lib/normal-file'
			'lib/should.ignore'
			'lib/thistoo.ignore'
		]
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'test.ignore'
			'root.ignore'
			'lib/normal-file'
		])

	it 'should filter absolute paths starting from subdirectories', ->

		ignore = new FileIgnorer('.' + path.sep)
		ignore.gitIgnoreEntries = [
			{ pattern: '/ignore', filePath: 'app/.gitignore' }
		]
		files = [
			'app/ignore'
			'app/ignore/file'
			'app/keep'
			'app/keep/file'
		]
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'app/keep'
			'app/keep/file'
		])

	it 'should not filter entries with an exclamation mark', ->

		ignore = new FileIgnorer('.' + path.sep)
		ignore.gitIgnoreEntries = [
			{ pattern: '*', filePath: 'app/.gitignore' }
			{ pattern: '!keep-me', filePath: 'app/.gitignore' }
		]
		files = [
			'app/remove-me'
			'app/keep-me'
		]
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'app/keep-me'
		])

	it 'should filter directories only from subdirectories', ->

		ignore = new FileIgnorer('.' + path.sep)
		ignore.gitIgnoreEntries = [
			{ pattern: 'vendor/', filePath: 'vendor/user/package/.gitignore' }
		]
		files = [
			'vendor/another/package/file'
			'vendor/another/package/vendor/file'
			'vendor/user/package/file'
			'vendor/user/package/vendor/file'
		]
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
			'vendor/another/package/file'
			'vendor/another/package/vendor/file'
			'vendor/user/package/file'
		])

	it 'should filter properly when two gitignore files match', ->

		ignore = new FileIgnorer('.' + path.sep)
		ignore.gitIgnoreEntries = [
			{ pattern: 'c', filePath: 'a/b/.gitignore' }
			{ pattern: 'delete-me', filePath: 'a/b/c/.gitignore' }
		]
		files = [
			'a/b/c/deleted-due-to-parent-gitignore'
			'a/b/c/delete-me'
		]
		expect(_.filter(files, ignore.filter.bind(ignore))).to.deep.equal([
		])

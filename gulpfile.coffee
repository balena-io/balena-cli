mkdirp = require('mkdirp')
path = require('path')
gulp = require('gulp')
mocha = require('gulp-mocha')
coffee = require('gulp-coffee')
markedMan = require('gulp-marked-man')
coffeelint = require('gulp-coffeelint')
shell = require('gulp-shell')
mochaNotifierReporter = require('mocha-notifier-reporter')
packageJSON = require('./package.json')

OPTIONS =
	config:
		coffeelint: path.join(__dirname, 'coffeelint.json')
	files:
		coffee: [ 'lib/**/*.coffee', 'gulpfile.coffee' ]
		app: [ 'lib/**/*.coffee', '!lib/**/*.spec.coffee' ]
		tests: 'tests/**/*.spec.coffee'
		json: [ 'lib/**/*.json', 'package.json' ]
		man: 'man/**/*.md'
	directories:
		man: 'man/'
		build: 'build/'

gulp.task 'man', ->
	gulp.src(OPTIONS.files.man)
		.pipe(markedMan())
		.pipe(gulp.dest(OPTIONS.directories.man))

gulp.task 'test', ->
	gulp.src(OPTIONS.files.tests, read: false)
		.pipe(mocha({
			reporter: mochaNotifierReporter.decorate('landing')
		}))

gulp.task 'coffee', [ 'test', 'lint', 'json' ], ->
	gulp.src(OPTIONS.files.app)
		.pipe(coffee())
		.pipe(gulp.dest(OPTIONS.directories.build))

gulp.task 'json', ->
	gulp.src(OPTIONS.files.json)
		.pipe(gulp.dest(OPTIONS.directories.build))

gulp.task 'lint', ->
	gulp.src(OPTIONS.files.coffee)
		.pipe(coffeelint({
			optFile: OPTIONS.config.coffeelint
		}))
		.pipe(coffeelint.reporter())

gulp.task 'build', [
	'coffee'
	'man'
]

gulp.task 'watch', [ 'test', 'lint' ], ->
	gulp.watch([ OPTIONS.files.coffee, OPTIONS.files.json ], [ 'coffee' ])
	gulp.watch([ OPTIONS.files.man ], [ 'man' ])

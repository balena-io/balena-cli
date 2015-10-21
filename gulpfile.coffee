path = require('path')
gulp = require('gulp')
mocha = require('gulp-mocha')
coffee = require('gulp-coffee')
coffeelint = require('gulp-coffeelint')
shell = require('gulp-shell')
packageJSON = require('./package.json')

OPTIONS =
	config:
		coffeelint: path.join(__dirname, 'coffeelint.json')
	files:
		coffee: [ 'lib/**/*.coffee', 'gulpfile.coffee' ]
		app: [ 'lib/**/*.coffee', '!lib/**/*.spec.coffee' ]
		tests: 'tests/**/*.spec.coffee'
	directories:
		build: 'build/'

gulp.task 'test', ->
	gulp.src(OPTIONS.files.tests, read: false)
		.pipe(mocha({
			reporter: 'min'
		}))

gulp.task 'coffee', [ 'test', 'lint' ], ->
	gulp.src(OPTIONS.files.app)
		.pipe(coffee())
		.pipe(gulp.dest(OPTIONS.directories.build))

gulp.task 'lint', ->
	gulp.src(OPTIONS.files.coffee)
		.pipe(coffeelint({
			optFile: OPTIONS.config.coffeelint
		}))
		.pipe(coffeelint.reporter())

gulp.task 'build', [
	'coffee'
]

gulp.task 'watch', [ 'test', 'lint', 'coffee' ], ->
	gulp.watch([ OPTIONS.files.coffee ], [ 'coffee' ])

path = require('path')
gulp = require('gulp')
coffee = require('gulp-coffee')
coffeelint = require('gulp-coffeelint')
inlinesource = require('gulp-inline-source')
mocha = require('gulp-mocha')
shell = require('gulp-shell')
packageJSON = require('./package.json')

OPTIONS =
	config:
		coffeelint: path.join(__dirname, 'coffeelint.json')
	files:
		coffee: [ 'lib/**/*.coffee', 'gulpfile.coffee' ]
		app: 'lib/**/*.coffee'
		tests: 'tests/**/*.spec.coffee'
		pages: 'lib/auth/pages/*.ejs'
	directories:
		build: 'build/'

gulp.task 'pages', ->
	gulp.src(OPTIONS.files.pages)
		.pipe(inlinesource())
		.pipe(gulp.dest('build/auth/pages'))

gulp.task 'coffee', [ 'lint' ], ->
	gulp.src(OPTIONS.files.app)
		.pipe(coffee(bare: true, header: true))
		.pipe(gulp.dest(OPTIONS.directories.build))

gulp.task 'lint', ->
	gulp.src(OPTIONS.files.coffee)
		.pipe(coffeelint({
			optFile: OPTIONS.config.coffeelint
		}))
		.pipe(coffeelint.reporter())

gulp.task 'test', ->
	gulp.src(OPTIONS.files.tests, read: false)
		.pipe(mocha({
			reporter: 'min'
		}))

gulp.task 'build', [
	'coffee',
	'pages'
]

gulp.task 'watch', [ 'build' ], ->
	gulp.watch([ OPTIONS.files.coffee ], [ 'build' ])

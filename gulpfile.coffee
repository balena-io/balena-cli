path = require('path')
gulp = require('gulp')
gutil = require('gulp-util')
coffee = require('gulp-coffee')
mocha = require('gulp-mocha')
coffeelint = require('gulp-coffeelint')
mochaNotifierReporter = require('mocha-notifier-reporter')
runSequence = require('run-sequence')

OPTIONS =
	config:
		coffeelint: path.join(__dirname, 'coffeelint.json')
	files:
		coffee: [ 'lib/**/*.coffee', 'gulpfile.coffee' ]
		app: [ 'lib/**/*.coffee', '!lib/**/*.spec.coffee' ]
		tests: 'lib/**/*.spec.coffee'
		json: 'lib/**/*.json'
	dirs:
		build: 'build/'

gulp.task 'test', ->
	gulp.src(OPTIONS.files.tests, read: false)
		.pipe(mocha({
			reporter: mochaNotifierReporter.decorate('landing')
		}))

gulp.task 'coffee', ->
	gulp.src(OPTIONS.files.app)
		.pipe(coffee()).on('error', gutil.log)
		.pipe(gulp.dest(OPTIONS.dirs.build))

gulp.task 'json', ->
	gulp.src(OPTIONS.files.json)
		.pipe(gulp.dest(OPTIONS.dirs.build))

gulp.task 'build', (callback) ->
	runSequence [ 'test', 'lint' ], [ 'json', 'coffee' ], callback

gulp.task 'lint', ->
	gulp.src(OPTIONS.files.coffee)
		.pipe(coffeelint({
			optFile: OPTIONS.config.coffeelint
		}))
		.pipe(coffeelint.reporter())

gulp.task 'watch', [ 'test', 'lint' ], ->
	gulp.watch([ OPTIONS.files.coffee, OPTIONS.files.json ], [ 'test', 'lint' ])

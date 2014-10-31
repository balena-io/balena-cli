path = require('path')
gulp = require('gulp')
mocha = require('gulp-mocha')
coffeelint = require('gulp-coffeelint')
mochaNotifierReporter = require('mocha-notifier-reporter')

OPTIONS =
	config:
		coffeelint: path.join(__dirname, 'coffeelint.json')
	files:
		coffee: [ 'lib/**/*.coffee', 'gulpfile.coffee' ]
		tests: 'lib/**/*.spec.coffee'

gulp.task 'test', ->
	gulp.src(OPTIONS.files.tests, read: false)
		.pipe(mocha({
			reporter: mochaNotifierReporter.decorate('list')
		}))

gulp.task 'lint', ->
	gulp.src(OPTIONS.files.coffee)
		.pipe(coffeelint({
			optFile: OPTIONS.config.coffeelint
		}))
		.pipe(coffeelint.reporter())

gulp.task 'watch', [ 'test', 'lint' ], ->
	gulp.watch(OPTIONS.files.tests, [ 'test' ])
	gulp.watch(OPTIONS.files.coffee, [ 'lint' ])

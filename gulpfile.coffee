path = require('path')
gulp = require('gulp')
mocha = require('gulp-mocha')
markedMan = require('gulp-marked-man')
coffeelint = require('gulp-coffeelint')
mochaNotifierReporter = require('mocha-notifier-reporter')

OPTIONS =
	config:
		coffeelint: path.join(__dirname, 'coffeelint.json')
	files:
		coffee: [ 'lib/**/*.coffee', 'gulpfile.coffee' ]
		app: [ 'lib/**/*.coffee', '!lib/**/*.spec.coffee' ]
		tests: 'lib/**/*.spec.coffee'
		json: 'lib/**/*.json'
		man: 'man/**/*.md'
	directories:
		man: 'man/'

gulp.task 'man', ->
	gulp.src(OPTIONS.files.man)
		.pipe(markedMan())
		.pipe(gulp.dest(OPTIONS.directories.man))

gulp.task 'test', ->
	gulp.src(OPTIONS.files.tests, read: false)
		.pipe(mocha({
			reporter: mochaNotifierReporter.decorate('landing')
		}))

gulp.task 'lint', ->
	gulp.src(OPTIONS.files.coffee)
		.pipe(coffeelint({
			optFile: OPTIONS.config.coffeelint
		}))
		.pipe(coffeelint.reporter())

gulp.task 'build', [
	'lint'
	'test'
	'man'
]

gulp.task 'watch', [ 'test', 'lint' ], ->
	gulp.watch([ OPTIONS.files.coffee, OPTIONS.files.json ], [ 'test', 'lint' ])
	gulp.watch([ OPTIONS.files.man ], [ 'man' ])

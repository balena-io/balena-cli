path = require('path')
gulp = require('gulp')
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
	directories:
		build: 'build/'

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

gulp.task 'watch', [ 'coffee' ], ->
	gulp.watch([ OPTIONS.files.coffee ], [ 'coffee' ])

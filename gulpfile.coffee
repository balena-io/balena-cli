path = require('path')
gulp = require('gulp')
coffee = require('gulp-coffee')
inlinesource = require('gulp-inline-source')
shell = require('gulp-shell')
packageJSON = require('./package.json')

OPTIONS =
	files:
		coffee: [ 'lib/**/*.coffee', 'gulpfile.coffee' ]
		app: 'lib/**/*.coffee'
		tests: 'tests/**/*.spec.js'
		pages: 'lib/auth/pages/*.ejs'
	directories:
		build: 'build/'

gulp.task 'pages', ->
	gulp.src(OPTIONS.files.pages)
		.pipe(inlinesource())
		.pipe(gulp.dest('build/auth/pages'))

gulp.task 'coffee', ->
	gulp.src(OPTIONS.files.app)
		.pipe(coffee(bare: true, header: true))
		.pipe(gulp.dest(OPTIONS.directories.build))

gulp.task 'build', gulp.series [
	'coffee',
	'pages'
]

gulp.task 'watch', gulp.series [ 'build' ], ->
	gulp.watch([ OPTIONS.files.coffee ], [ 'build' ])

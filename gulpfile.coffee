path = require('path')
gulp = require('gulp')
inlinesource = require('gulp-inline-source')
shell = require('gulp-shell')
packageJSON = require('./package.json')

OPTIONS =
	files:
		coffee: [ 'gulpfile.coffee' ]
		tests: 'tests/**/*.spec.js'
		pages: 'lib/auth/pages/*.ejs'
	directories:
		build: 'build/'

gulp.task 'pages', ->
	gulp.src(OPTIONS.files.pages)
		.pipe(inlinesource())
		.pipe(gulp.dest('build/auth/pages'))

gulp.task 'build', gulp.series [
	'pages'
]

gulp.task 'watch', gulp.series [ 'build' ], ->
	gulp.watch([ OPTIONS.files.coffee ], [ 'build' ])

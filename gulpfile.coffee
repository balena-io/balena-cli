gulp = require('gulp')
mocha = require('gulp-mocha')
mochaNotifierReporter = require('mocha-notifier-reporter')

OPTIONS =
  paths:
    tests: 'lib/**/*.spec.coffee'

gulp.task 'test', ->
  gulp.src(OPTIONS.paths.tests, read: false)
    .pipe(mocha({
      reporter: mochaNotifierReporter.decorate('list')
    }))

gulp.task 'watch', [ 'test' ], ->
  gulp.watch(OPTIONS.paths.tests, [ 'test' ])

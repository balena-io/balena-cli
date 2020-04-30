const gulp = require('gulp');
const inlinesource = require('gulp-inline-source');

const OPTIONS = {
	files: {
		pages: 'lib/auth/pages/*.ejs',
	},
};

gulp.task('pages', () =>
	gulp
		.src(OPTIONS.files.pages)
		.pipe(inlinesource())
		.pipe(gulp.dest('build/auth/pages')),
);

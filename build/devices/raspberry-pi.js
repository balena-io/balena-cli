(function() {
  var diskio, fs, progressStream;

  fs = require('fs');

  progressStream = require('progress-stream');

  diskio = require('diskio');

  exports.name = 'Raspberry Pi';

  exports.write = function(options, callback) {
    var error, imageFileSize, imageFileStream, progress;
    imageFileSize = fs.statSync(options.image).size;
    if (imageFileSize === 0) {
      error = new Error("Invalid OS image: " + options.image + ". The image is 0 bytes.");
      return callback(error);
    }
    progress = progressStream({
      length: imageFileSize,
      time: 500
    });
    if (!options.quiet) {
      progress.on('progress', options.progress);
    }
    imageFileStream = fs.createReadStream(options.image).pipe(progress);
    return diskio.writeStream(options.device, imageFileStream, callback);
  };

}).call(this);

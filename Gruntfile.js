module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    build: {
      src: 'src/js/dependencies.js',
      options: {
        baseDir: 'src/js/'
      }
    },
    deps: {
      src: 'src/js/dependencies.js',
      options: {
        baseDir: 'src/js/'
      }
    },
    clean: {
      build: ['build/files/*'],
      dist: ['dist/*']
    },
    // Current forEach issue: https://github.com/gruntjs/grunt/issues/610
    // npm install https://github.com/gruntjs/grunt-contrib-jshint/archive/7fd70e86c5a8d489095fa81589d95dccb8eb3a46.tar.gz
    jshint: {
      src: {
        src: ['src/js/*.js', 'Gruntfile.js', 'test/unit/*.js'],
        options: {
          jshintrc: '.jshintrc'
        }
      }
    },
    minify: {
      source:{
        src: ['build/files/combined.video.js'],
        externs: ['src/js/media.flash.externs.js'],
        dest: 'build/files/minified.video.js'
      },
      tests: {
        src: ['build/files/combined.video.js', 'test/unit/*.js'],
        externs: ['src/js/media.flash.externs.js', 'test/qunit/qunit-externs.js'],
        dest: 'build/files/test.minified.video.js'
      }
    },
    dist: {},
    qunit: {
      source: ['test/index.html'],
      minified: ['test/minified.html']
    },
    watch: {
      files: [ 'src/**/*.js', 'test/unit/*.js' ],
      tasks: 'dev'
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // Default task.
  grunt.registerTask('default', ['jshint', 'build', 'minify', 'dist']);
  // Development watch task
  grunt.registerTask('dev', ['jshint', 'build', 'qunit:source']);
  grunt.registerTask('test', ['jshint', 'build', 'minify:tests', 'qunit']);

  var fs = require('fs'),
      gzip = require('zlib').gzip;

  // Call with --skipBundledClosure to generate a source file list without the
  // bundled file src/js/goog.base.js
  grunt.registerMultiTask('build', 'Building Source', function(){
    /*jshint undef:false, evil:true */

    // Loading predefined source order from source-loader.js
    // Trust me, this is the easist way to do it so far.
    var blockSourceLoading = true;
    var skipBundledClosure = grunt.option( 'skipBundledClosure' );
    eval(grunt.file.read('./build/source-loader.js'));

    // Fix windows file path delimiter issue
    var i = sourceFiles.length;
    while (i--) {
      sourceFiles[i] = sourceFiles[i].replace(/\\/g, '/');
    }

    // Allow time for people to update their index.html before they remove these
    grunt.file.write('build/files/sourcelist.js', 'var sourcelist = ["' + sourceFiles.join('","') + '"]');
    // These versions can be useful for other scripts which need low-level
    // access to the file list. sourcelist.txt is source paths, one per line;
    // sourcelist.json is the source paths array as a JSON array
    grunt.file.write('build/files/sourcelist.txt', sourceFiles.join('\n') + '\n');
    grunt.file.write('build/files/sourcelist.json', JSON.stringify(sourceFiles));

    // Create a combined sources file. https://github.com/zencoder/video-js/issues/287
    var combined = '';
    sourceFiles.forEach(function(result){
      combined += grunt.file.read(result);
    });
    grunt.file.write('build/files/combined.video.js', combined);

    grunt.file.copy('src/css/video-js.css', 'build/files/video-js.css');
    grunt.file.copy('src/css/video-js.png', 'build/files/video-js.png');
    grunt.file.copy('src/swf/video-js.swf', 'build/files/video-js.swf');
  });

  grunt.registerMultiTask('minify', 'Minify JS files using Closure Compiler.', function() {
    var done = this.async();
    var exec = require('child_process').exec;

    var externs = this.file.externs || [];
    var dest = this.file.dest;
    var files = [];

    // Make sure deeper directories exist for compiler
    grunt.file.write(dest, '');

    if (this.data.sourcelist) {
      files = files.concat(grunt.file.read(this.data.sourcelist).split(','));
    }
    if (this.file.src) {
      files = files.concat(this.file.src);
    }

    var command = 'java -jar build/compiler/compiler.jar'
                + ' --compilation_level ADVANCED_OPTIMIZATIONS'
                // + ' --formatting=pretty_print'
                + ' --js_output_file=' + dest
                + ' --create_source_map ' + dest + '.map --source_map_format=V3'
                + ' --jscomp_warning=checkTypes --warning_level=VERBOSE';
                + ' --output_wrapper "(function() {%output%})();//@ sourceMappingURL=video.js.map"';

    files.forEach(function(file){
      command += ' --js='+file;
    });

    externs.forEach(function(extern){
      command += ' --externs='+extern;
    });

    // grunt.log.writeln(command)

    exec(command, { maxBuffer: 500*1024 }, function(err, stdout, stderr){

      if (err) {
        grunt.warn(err);
        done(false);
      }

      if (stdout) {
        grunt.log.writeln(stdout);
      }

      done();
    });
  });

  grunt.registerTask('dist', 'Creating distribution', function(){
    // TODO: create semver folders (4.1.1, 4.1, 4, and latest)
    // grunt copy could be used but is currently broken and needs an update
    grunt.file.copy('build/files/minified.video.js', 'dist/video-js/video.js');
    grunt.file.copy('build/files/video-js.css', 'dist/video-js/video-js.css');
    grunt.file.copy('build/files/video-js.png', 'dist/video-js/video-js.png');
    grunt.file.copy('build/files/video-js.swf', 'dist/video-js/video-js.swf');
    grunt.file.copy('build/demo-files/demo.html', 'dist/video-js/demo.html');
    grunt.file.copy('build/demo-files/demo.captions.vtt', 'dist/video-js/demo.captions.vtt');

    // Copy is broken. Waiting for an update to use.
    // copy: {
    //   latest: {
    //     files: [
    //       { src: ['dist/video-js'], dest: 'dist/latest' } // includes files in path
    //       // {src: ['path/**'], dest: 'dest/'}, // includes files in path and its subdirs
    //       // {expand: true, cwd: 'path/', src: ['**'], dest: 'dest/'}, // makes all src relative to cwd
    //       // {expand: true, flatten: true, src: ['path/**'], dest: 'dest/', filter: 'isFile'} // flattens results to a single level
    //     ]
    //   }
    // },
  });
};

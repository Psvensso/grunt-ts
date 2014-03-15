/// <reference path="../../defs/tsd.d.ts"/>
/// <reference path="./interfaces.d.ts"/>
var path = require('path');
var fs = require('fs');
var _ = require('underscore');
var utils = require('./utils');

var Promise = require('es6-promise').Promise;
exports.grunt = require('grunt');

///////////////////////////
// Helper
///////////////////////////
function executeNode(args) {
    return new Promise(function (resolve, reject) {
        exports.grunt.util.spawn({
            cmd: 'node',
            args: args
        }, function (error, result, code) {
            var ret = {
                code: code,
                output: String(result)
            };
            resolve(ret);
        });
    });
}

/////////////////////////////////////////////////////////////////////
// tsc handling.
////////////////////////////////////////////////////////////////////
function resolveTypeScriptBinPath() {
    var ownRoot = path.resolve(path.dirname((module).filename), '../..');
    var userRoot = path.resolve(ownRoot, '..', '..');
    var binSub = path.join('node_modules', 'typescript', 'bin');

    if (fs.existsSync(path.join(userRoot, binSub))) {
        // Using project override
        return path.join(userRoot, binSub);
    }
    return path.join(ownRoot, binSub);
}

function getTsc(binPath) {
    var pkg = JSON.parse(fs.readFileSync(path.resolve(binPath, '..', 'package.json')).toString());
    exports.grunt.log.writeln('Using tsc v' + pkg.version);

    return path.join(binPath, 'tsc');
}

function compileAllFiles(targetFiles, target, task) {
    // Make a local copy to mutate freely
    var files = _.map(targetFiles, function (file) {
        return file;
    });

    // If baseDir is specified create a temp tsc file to make sure that `--outDir` works fine
    // see https://github.com/grunt-ts/grunt-ts/issues/77
    var baseDirFile = 'ignoreBaseDirFile.ts';
    var baseDirFilePath;
    if (target.outDir && target.baseDir && files.length > 0) {
        baseDirFilePath = path.join(target.baseDir, baseDirFile);
        if (!fs.existsSync(baseDirFilePath)) {
            fs.writeFileSync(baseDirFilePath, '// Ignore this file. See https://github.com/grunt-ts/grunt-ts/issues/77');
        }
        files.push(baseDirFilePath);
    }

    var args = files.slice(0);

    // boolean options
    if (task.sourceMap) {
        args.push('--sourcemap');
    }
    if (task.declaration) {
        args.push('--declaration');
    }
    if (task.removeComments) {
        args.push('--removeComments');
    }
    if (task.noImplicitAny) {
        args.push('--noImplicitAny');
    }
    if (task.noResolve) {
        args.push('--noResolve');
    }

    // string options
    args.push('--target', task.target.toUpperCase());
    args.push('--module', task.module.toLowerCase());

    // Target options:
    if (target.out) {
        args.push('--out', target.out);
    }
    if (target.outDir) {
        if (target.out) {
            console.warn('WARNING: Option "out" and "outDir" should not be used together'.magenta);
        }
        args.push('--outDir', target.outDir);
    }
    if (task.sourceRoot) {
        args.push('--sourceRoot', task.sourceRoot);
    }
    if (task.mapRoot) {
        args.push('--mapRoot', task.mapRoot);
    }

    // Locate a compiler
    var tsc = getTsc(resolveTypeScriptBinPath());

    // To debug the tsc command
    if (task.verbose) {
        console.log(args.join(' ').yellow);
    } else {
        exports.grunt.log.verbose.writeln(args.join(' ').yellow);
    }

    // Create a temp last command file and use that to guide tsc.
    // Reason: passing all the files on the command line causes TSC to go in an infinite loop.
    var tempfilename = utils.getTempFile('tscommand');
    if (!tempfilename) {
        throw (new Error('cannot create temp file'));
    }

    fs.writeFileSync(tempfilename, args.join(' '));

    // Execute command
    return executeNode([tsc, '@' + tempfilename]).then(function (result) {
        fs.unlinkSync(tempfilename);

        exports.grunt.log.writeln(result.output);

        return Promise.cast(result);
    }, function (err) {
        fs.unlinkSync(tempfilename);
        throw err;
    });
}
exports.compileAllFiles = compileAllFiles;
//# sourceMappingURL=compile.js.map

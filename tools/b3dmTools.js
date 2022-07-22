var fsExtra = require('fs-extra');
var zlib = require('zlib');
var Promise = require('bluebird');
var zlibGunzip = Promise.promisify(zlib.gunzip);
var extractB3dm = require('./extractB3dm');
const gltfPipeline = require("gltf-pipeline");
const processGltf = gltfPipeline.processGltf;
const processGlb = gltfPipeline.processGlb;
var optimizeGlb = require('./optimizeGlb');
var createB3dm = require('./createB3dm');
var zlibGzip = Promise.promisify(zlib.gzip);
function readB3dmWriteGlb(inputPath, outputPath, force) {
    outputPath = defaultValue(outputPath, inputPath.slice(0, inputPath.length - 4) + 'glb');
    return checkFileOverwritable(outputPath, force)
        .then(function() {
            return readFile(inputPath);
        })
        .then(function(b3dm) {
            return fsExtra.outputFile(outputPath, extractB3dm(b3dm).glb);
        });
}
function checkFileOverwritable(file, force) {
    if (force) {
        return Promise.resolve();
    }
    return fileExists(file)
        .then(function (exists) {
            if (exists) {
                throw new Error('File ' + file + ' already exists. Specify -f or --force to overwrite existing files.');
            }
        });
}
function fileExists(filePath) {
    return fsExtra.stat(filePath)
        .then(function(stats) {
            return stats.isFile();
        })
        .catch(function(err) {
            // If the file doesn't exist the error code is ENOENT.
            // Otherwise something else went wrong - permission issues, etc.
            if (err.code !== 'ENOENT') {
                throw err;
            }
            return false;
        });
}
function readFile(file) {
    return fsExtra.readFile(file)
        .then(function(fileBuffer) {
            if (isGzipped(fileBuffer)) {
                return zlibGunzip(fileBuffer);
            }
            return fileBuffer;
        });
}
function isGzipped(buffer) {
    return (buffer[0] === 0x1f) && (buffer[1] === 0x8b);
}


function readAndOptimizeB3dm(inputPath, outputPath = inputPath.slice(0, inputPath.length - 5) + '-optimized.b3dm', force, optionArgs) {


    var gzipped;
    var b3dm;
    return checkFileOverwritable(outputPath, force)
        .then(function() {
            return fsExtra.readFile(inputPath);
        })
        .then(function(fileBuffer) {
            gzipped = isGzipped(fileBuffer);
            if (isGzipped(fileBuffer)) {
                return zlibGunzip(fileBuffer);
            }
            return fileBuffer;
        })
        .then(function(fileBuffer) {
            b3dm = extractB3dm(fileBuffer);

            // return optimizeGlb(b3dm.glb, options);
            return  processGlb(b3dm.glb, optionArgs);
        })
        .then(function(glbBuffer) {
            console.log(glbBuffer);
            console.log(glbBuffer.glb.length);
            var b3dmBuffer = createB3dm({
                glb: glbBuffer.glb, 
                featureTableJson: b3dm.featureTable.json, 
                featureTableBinary: b3dm.featureTable.binary,
                batchTableJson: b3dm.batchTable.json, 
                batchTableBinary: b3dm.batchTable.binary});
            if (gzipped) {
                return zlibGzip(b3dmBuffer);
            }
            return b3dmBuffer;
        })
        .then(function(buffer) {
            return fsExtra.outputFile(outputPath, buffer);
        });
}

module.exports = {
    readAndOptimizeB3dm
}
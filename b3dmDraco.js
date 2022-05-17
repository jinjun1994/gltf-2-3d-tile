const fs = require('fs');
const readAndOptimizeB3dm = require('./tools/b3dmTools').readAndOptimizeB3dm;
var fsExtra = require('fs-extra');
function b3dmDraco(path) {

    // get all file in path
    fs.readdir(path, (err, files) => {
        if (err) throw err;
        // loop through all files
        for (const file of files) {
            // check if file is dir
            const filePath = path + '/' + file;
            fs.stat(filePath, (err, stats) => {
                if (err) throw err;
                // if file is dir
                if (stats.isDirectory()) {
                    // recurse
                    b3dmDraco(filePath);
                } else {
                    // if file is b3dm
                    if (file.endsWith('.b3dm')) {
                        // read and optimize b3dm
                        readAndOptimizeB3dm(
                            filePath,
                            filePath.replace("converterOut2", "converterOut2optimize7"),
                            false, {
                            dracoOptions: {
                                compressMeshes: true,
                                compressionLevel: 7,
                                unifiedQuantization: true,
                            },
                        });
                    }
                    else{
                        // save json file to same path
                        fsExtra.copy(filePath, filePath.replace("converterOut2", "converterOut2optimize7"), (err) => {
                            if (err) throw err;
                        }
                        );



                    }
                }
            }
            );
        }
    }
    );
}

b3dmDraco("F:/osgb/converterOut2");

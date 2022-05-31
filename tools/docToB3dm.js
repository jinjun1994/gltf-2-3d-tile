'use strict';
var createB3dm = require('./createB3dm');

module.exports = doc2B3dm;

/**
 * Convert obj model to b3dm file.
 * 
 * @param {String} objPath The obj model file path. 
 * @param {String} outputPath Output file path.
 * @param {Object} options Optional parameters.
 */
function doc2B3dm(glb, options) {

  
    var batchTableJson = options.batchTableJson;
    var length = batchTableJson.name.length; // maxPoint always be there
    return new Promise(function (resolve, reject) {
       if(!length) reject('maxPoint is not defined');
        resolve({
            b3dm: createB3dm({
                glb: glb,
                featureTableJson: {
                    BATCH_LENGTH: length
                },
                batchTableJson: batchTableJson
            }),
            batchTableJson: batchTableJson
        });
    });

}

/**
 * Default value for optional pramater.
 */
doc2B3dm.defaults = {
    /**
     * Gets or sets whether add the _BATCHID semantic to gltf per-model's attributes.
     * If true, _BATCHID begin from 0 for first mesh and add one for the next.
     * @type Boolean
     * @default false
     */
    batchId: false,
    /**
     * Gets or sets whether create b3dm model file, with _BATCHID and default batch table per-mesh.
     * @type Boolean
     * @default false
     */
    b3dm: false,
    /**
     * Gets or sets whether create BtchTable Json file.
     * @type Boolean
     * @default false
     */
    outputBatchTable: false,
    /**
     * Sets the default BatchTable object, should have proper property "batchId" Array.
     * @type Object
     * @default undefined
     */
    customBatchTable: undefined
};
const { dedup, inspect, utils, prune } = require('@gltf-transform/functions');
var fsExtra = require('fs-extra');
const { NodeIO } = require('@gltf-transform/core');
const io = new NodeIO()
const path = require('path');
module.exports = async ({ newDocPath, glb }) => {

    try {
        // const newDoc = await io.read(newDocPath);
        const newDoc = await io.readBinary(glb);
        const doc = await newDoc.transform(prune())

        const glb2 = await io.writeBinary(doc)
        // fsExtra.outputFile(newDocPath.replace(".newDoc", ""), glb2)
        return glb2
    } catch (error) {
        console.log(newDocPath);
        console.log(error);
        console.log("worker error");

    }




};
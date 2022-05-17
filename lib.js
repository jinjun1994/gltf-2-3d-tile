const mergeGltfs = require('./tools/merge-gltfs');
const {  gltf_to_tileset } = require('./index');
const { Document, NodeIO, Accessor, BufferUtils, Primitive } = require('@gltf-transform/core');
const ext = require('@gltf-transform/extensions');

async function tileset(
     fin,
     fout, 
     measure,
     ){
        console.log("split gltf model to 3d tiles");
        const startTime = new Date().getTime();

        const gltfs = [fin];
        const options = {
            output: "./models/output.gltf",
            normal: true,
        }
       const  doc = await mergeGltfs(gltfs,options)
  const io = new NodeIO().registerExtensions(ext.KHRONOS_EXTENSIONS);

        // const doc = await io.read("./models/office/scene.gltf");

        if (!fout)  fout = "./models/office/tile/"
    
        await gltf_to_tileset(doc, fout)
        // copy_textures(fin, fout, gltf.images)
        const endTime = new Date().getTime();
        console.log("split gltf model to 3d tiles: " + (endTime - startTime) + "ms");
     }

(async () => {
    await tileset()
})();
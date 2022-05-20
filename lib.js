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
    //    const  doc = await mergeGltfs(gltfs,options)
  const io = new NodeIO().registerExtensions(ext.KHRONOS_EXTENSIONS);

        // const doc = await io.read("./models/jianzhu/合并_建筑.gltf.transform.dedup.glb");
        const doc = await io.read("./models/jiaju/合并_家具.gltf.transform.dedup.glb");

        // if (!fout)  fout = "./models/jianzhu/tile/"
        if (!fout)  fout = "./models/jiaju/tile/"
    
        await gltf_to_tileset(doc, fout)
        // copy_textures(fin, fout, gltf.images)
        const endTime = new Date().getTime();
        console.log("split gltf model to 3d tiles: " + (endTime - startTime) + "ms");
     }

(async () => {
    await tileset()
})();
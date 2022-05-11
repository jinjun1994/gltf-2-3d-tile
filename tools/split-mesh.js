const { Document, NodeIO, Accessor, BufferUtils, Primitive } = require('@gltf-transform/core');
const { dedup, prune, weld } = require('@gltf-transform/functions');
//[Question: How to split meshes to separate gltf? · Issue #188 · donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform/issues/188)

async function splitGltf(gltf) {
   const docs = []
   for (const [index, mesh] of Object.entries(
      gltf.getRoot().listMeshes()
   //    [
   //       gltf.getRoot().listMeshes()[0],
   //       gltf.getRoot().listMeshes()[1],
   //       gltf.getRoot().listMeshes()[2],
   //       gltf.getRoot().listMeshes()[3],
   //       gltf.getRoot().listMeshes()[4],
   
   // ]
   )) {

      const newDoc = gltf.clone();


      const curentMesh = newDoc.getRoot().listMeshes()[index];
      const oldScene = newDoc.getRoot().getDefaultScene();
      oldScene.dispose();
      const scene = newDoc.createScene();
      newDoc.getRoot().setDefaultScene(scene);
      const node = newDoc.createNode("test");
      node.setMesh(curentMesh);
      scene.addChild(node);

      const name = mesh.getName();
      //[Possibility to specify name for .bin files emmited from partition command? · Discussion #412 · donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform/discussions/412)
      newDoc.getRoot().listBuffers()[0].setURI(name + '.bin');


      await newDoc.transform(weld(), dedup(), prune());

      
      // const io = new NodeIO()
      //  await io.write("./models/split/"+name+".gltf", newDoc);
      docs.push(newDoc)
   }
   return docs
}


// (async () => {
//     const io = new NodeIO()
//     const doc = await io.read("./models/output.gltf");
//     splitGltf(doc);
// }
// )();


module.exports = {
   splitGltf
}
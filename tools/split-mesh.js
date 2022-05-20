const { Document, NodeIO, Accessor, BufferUtils, Primitive } = require('@gltf-transform/core');
const { dedup, prune, weld } = require('@gltf-transform/functions');
//[Question: How to split meshes to separate gltf? · Issue #188 · donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform/issues/188)
const { instanceDoc } = require('../functions/instance');
const { allProgress } = require('./utils');

async function splitGltf(gltf) {

   const result =  await instanceDoc(gltf);
   console.log(result);
   return result




   const promiseArray = gltf.getRoot().listMeshes().map((mesh, index) => {
      const newDoc = gltf.clone();


      const curentMesh = newDoc.getRoot().listMeshes()[index];
      const oldScene = newDoc.getRoot().getDefaultScene();
      oldScene.dispose();
      const scene = newDoc.createScene();
      newDoc.getRoot().setDefaultScene(scene);
      const node = newDoc.createNode(mesh.getName());
      node.setMesh(curentMesh);
      scene.addChild(node);
      newDoc.getRoot().listNodes().forEach(element => {
         if (node != element) element.dispose();
      });


      // scene.traverse((n) => {
      //    console.log(node != n);
      //    if (node != n) scene.removeChild(n);
      // })

      const name = mesh.getName();
      //[Possibility to specify name for .bin files emmited from partition command? · Discussion #412 · donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform/discussions/412)
      newDoc.getRoot().listBuffers()[0].setURI(name + '.bin');

      console.log(index);
      return newDoc.transform(prune()).then((doc) => {
         console.log(`Done ${index}`);
         return doc;
      });
   });
   // return Promise.all(promiseArray)

   // return docs
   console.log(promiseArray);
   return allProgress(promiseArray,
      (p) => {
         console.log(`% Done = ${p.toFixed(2)}`);
      });
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
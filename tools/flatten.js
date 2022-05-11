const fs = require('fs').promises;
const path = require('path');
const { Document, NodeIO, Accessor, Primitive } = require('@gltf-transform/core');

const ext = require('@gltf-transform/extensions');
const vec3 = require('gl-matrix').vec3;

const {
  traverseNode,
  extractElementInfo,
  extractSimlabInfo, copyMaterial, flattenArray, flattenIndex } = require('./utils');

/*
  适用于 simlab 从 revit 转换的 gltf/glb 文件
  可同时处理多个文件，但由于不同文件的 element id 可能有相同的，这种情况下两个或多个物体会被合并在一起，当作一个
*/

module.exports = async (gltfs, options) => {
  console.log(options);

  console.time('Total');

  const io = new NodeIO().registerExtensions(ext.KHRONOS_EXTENSIONS);

  const newDoc = new Document();
  const scene = newDoc.createScene();
  newDoc.getRoot().setDefaultScene(scene);
  const newBuffer = newDoc.createBuffer();

  const objectInfo = {};
  let currentId = -1;

  for (const gltf of gltfs) {
    const doc = io.read(gltf);
    doc.getRoot().getDefaultScene().listChildren()
      .forEach((node) => {
        traverseNode(node, flatten);
      });
  }

  console.log(`Total Elements: ${currentId + 1}`);
  console.log('done flatten, saving...');

  const output = options.output;
  await fs.writeFile(path.join(path.dirname(output), path.basename(output, path.extname(output)) + '.json'), JSON.stringify(objectInfo, null, 2));

  // 清理后可能导致无法 draco 压缩，故去除
  // await newDoc.transform(dedup(), prune());
  await io.write(output, newDoc);


  function flatten(node) {
    if (!node.getMesh()) {
      return;
    }

    let elementInfo;
    if (options.exporter === 'simlab') {
      elementInfo = extractSimlabInfo(node);
    } else {
      elementInfo = extractElementInfo(node);

    }
    if (!objectInfo[elementInfo.elementId]) {
      objectInfo[elementInfo.elementId] = elementInfo;
      currentId++;
      if (currentId && currentId % 1000 === 0) console.log(currentId);
    }

    node.getMesh().listPrimitives().forEach(p => {
      // 兼容一个 Mesh 有多个 Primitive 的情况
      const newNode = newDoc.createNode(elementInfo.name);
      const newMesh = newDoc.createMesh(elementInfo.name);

      // 未发现以下情况
      // if (!p.getAttribute('TEXCOORD_0') && p.getAttribute('TEXCOORD_1')) {
      //   console.log(elementInfo.name);
      // }
      // if (p.getAttribute('TEXCOORD_0') && !p.getAttribute('TEXCOORD_0').getArray().length) {
      //   console.log(elementInfo.name);
      // }
      const newPrim = newDoc.createPrimitive();
      newPrim.setMode(Primitive.Mode.TRIANGLES);
      newPrim.setAttribute('POSITION', flattenArray(newDoc, 'VEC3', [p.getAttribute('POSITION').getArray()]));
      if (p.getAttribute('NORMAL')) newPrim.setAttribute('NORMAL', flattenArray(newDoc, 'VEC3', [p.getAttribute('NORMAL').getArray()]));
      if (p.getAttribute('TEXCOORD_0') && p.getAttribute('TEXCOORD_0').getArray().length) newPrim.setAttribute('TEXCOORD_0', flattenArray(newDoc, 'VEC2', [p.getAttribute('TEXCOORD_0').getArray()]));
      if (p.getMaterial()?.getOcclusionTexture() && p.getAttribute('TEXCOORD_1') && p.getAttribute('TEXCOORD_1').getArray().length) {
        // console.log(node.getName(), p.getAttribute('TEXCOORD_0').getArray().length);
        newPrim.setAttribute('TEXCOORD_1', flattenArray(newDoc, 'VEC2', [p.getAttribute('TEXCOORD_1').getArray()]));
      }

      // const newPrim = doc.createPrimitive()
      // .setAttribute('_batchid', flattenArray('SCALAR', b));

      const count = newPrim.getAttribute('POSITION').getCount();
      for (let i = 0; i < count; i++) {
        const target = [0, 0, 0];
        newPrim.getAttribute('POSITION').getElement(i, target);
        const res = vec3.create();
        vec3.transformMat4(res, vec3.fromValues(...target), node.getWorldMatrix());
        newPrim.getAttribute('POSITION').setElement(i, res);
      }


      if (options.batchId) {
        const accessor = newDoc.createAccessor().setType(Accessor.Type.SCALAR);
        const array = new Uint32Array(count);
        array.fill(currentId);
        accessor.setArray(array);
        newPrim.setAttribute('_batchid', accessor);
        objectInfo[elementInfo.elementId].batchId = currentId;
      }

      newPrim.setIndices(flattenIndex(newDoc, [{ index: p.getIndices().getArray(), len: p.getAttribute('POSITION').getCount() }]));

      const material = p.getMaterial();
      if (!material) return;
      const newMaterial = newDoc.createMaterial(material.getName());
      try {
        copyMaterial(newDoc, material, newMaterial);
      } catch (err) {
        console.log(newMaterial.getName(), err);
      }
      newPrim.setMaterial(newMaterial);

      newPrim.listAttributes()
        .forEach((attribute) => {
          attribute.setBuffer(newBuffer);
        });

      newMesh.addPrimitive(newPrim);
      newNode.setMesh(newMesh);
      newDoc.getRoot().getDefaultScene().addChild(newNode);
    });
  }

  console.timeEnd('Total');
};


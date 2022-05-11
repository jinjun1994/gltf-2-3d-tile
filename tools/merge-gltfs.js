
const fs = require('fs');
const path = require('path');
const { Document, NodeIO, Accessor, BufferUtils, Primitive } = require('@gltf-transform/core');
const { dedup, prune, weld } = require('@gltf-transform/functions');
const ext = require('@gltf-transform/extensions');

const { mergeByMaterial } = require('./utils');
module.exports = async (gltfs, options) => {
  console.time('Total');
  console.log(gltfs, options);

  const newDoc = new Document();
  const scene = newDoc.createScene();
  newDoc.getRoot().setDefaultScene(scene);
  const newBuffer = newDoc.createBuffer();

  const io = new NodeIO().registerExtensions(ext.KHRONOS_EXTENSIONS);

  for (const gltf of gltfs) {
    const doc = await io.read(gltf);
    mergeByMaterial(doc, newDoc, options.normal, newBuffer);
  }

  await newDoc.transform(weld(), dedup(), prune());
  await io.write(options.output, newDoc);
  console.timeEnd('Total');

  return newDoc

};


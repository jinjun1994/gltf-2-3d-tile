const { Document, NodeIO, Accessor, BufferUtils, Primitive } = require('@gltf-transform/core');

BufferUtils.trim = (buffer) => {
  const { byteOffset, byteLength } = buffer;
  return buffer.buffer.slice(byteOffset, byteOffset + byteLength);
}


function flattenArray(newDoc, type, arrays) {
  const array = new Float32Array(BufferUtils.concat(arrays.map(BufferUtils.trim)));
  return newDoc.createAccessor().setType(type).setArray(array);
}

function flattenCustomArray(newDoc, type, arrays) {
  const array = new Uint32Array(BufferUtils.concat(arrays.map(BufferUtils.trim)));
  return newDoc.createAccessor().setType(type).setArray(array);
}

function flattenIndex(newDoc, arrays) {
  let length = 0;
  arrays.forEach(a => { length += a.index.length; });
  let array;
  if (length > 65535) {
    array = new Uint32Array(length);
  } else {
    array = new Uint16Array(length);
  }
  let positionLength = 0;
  let indexLength = 0;
  arrays.forEach(a => {
    for (let i = 0; i < a.index.length; i++) {
      array[i + indexLength] = a.index[i] + positionLength;
    }
    indexLength += a.index.length;
    positionLength += a.len;
  });
  return newDoc.createAccessor().setType(Accessor.Type.SCALAR).setArray(array);
}

function copyTextureInfo(src, dest) {
  dest._texCoord = src._texCoord;
  dest._magFilter = src._magFilter;
  dest._minFilter = src._minFilter;
  dest._wrapS = src._wrapS;
  dest._wrapT = src._wrapT;
}

function copyMaterial(newDoc, src, dest) {
  dest.setAlphaMode(src.getAlphaMode());
  dest.setAlphaCutoff(src.getAlphaCutoff());
  dest.setDoubleSided(src.getDoubleSided());
  dest.setBaseColorFactor(src.getBaseColorFactor());
  dest.setEmissiveFactor(src.getEmissiveFactor());
  dest.setNormalScale(src.getNormalScale());
  dest.setOcclusionStrength(src.getOcclusionStrength());
  dest.setRoughnessFactor(src.getRoughnessFactor());
  dest.setMetallicFactor(src.getMetallicFactor());

  const baseColorTexture = src.getBaseColorTexture();
  if (baseColorTexture) {
    const texture = newDoc.createTexture(baseColorTexture.getName());
    texture.copy(baseColorTexture);
    dest.setBaseColorTexture(texture);
    copyTextureInfo(src.getBaseColorTextureInfo(), dest.getBaseColorTextureInfo());
  }


  const emissiveTexture = src.getEmissiveTexture();
  if (emissiveTexture) {
    const texture = newDoc.createTexture(emissiveTexture.getName());
    texture.copy(emissiveTexture);
    dest.setEmissiveTexture(texture);
    dest.getEmissiveTextureInfo().copy(src.getEmissiveTextureInfo());
  }


  const normalTexture = src.getNormalTexture();
  if (normalTexture) {
    const texture = newDoc.createTexture(normalTexture.getName());
    texture.copy(normalTexture);
    dest.setNormalTexture(texture);
    dest.getNormalTextureInfo().copy(src.getNormalTextureInfo());
  }


  const occlusionTexture = src.getOcclusionTexture();
  if (occlusionTexture) {
    const texture = newDoc.createTexture(occlusionTexture.getName());
    texture.copy(occlusionTexture);
    dest.setOcclusionTexture(texture);
    dest.getOcclusionTextureInfo().copy(src.getOcclusionTextureInfo());
  }


  const metallicRoughnessTextureInfo = src.getMetallicRoughnessTexture();
  if (metallicRoughnessTextureInfo) {
    const texture = newDoc.createTexture(metallicRoughnessTextureInfo.getName());
    texture.copy(metallicRoughnessTextureInfo);
    dest.setMetallicRoughnessTexture(texture);
    dest.getMetallicRoughnessTextureInfo().copy(src.getMetallicRoughnessTextureInfo());
  }
}

function hasTextures(m) {
  return m.getNormalTexture() || m.getBaseColorTexture() || m.getEmissiveTexture() || m.getMetallicRoughnessTexture() || m.getOcclusionTexture();
}

function mergeByMaterial(doc, newDoc, normal, buffer) {

  for (const m of doc.getRoot().listMaterials()) {
    console.log(doc.getRoot().listMaterials().length);
    const material = newDoc.createMaterial(m.getName());
    try {
      copyMaterial(newDoc, m, material);
    } catch (err) {
      console.log(err);
    }

    const p = [],
      n = [],
      t = [],
      t1 = [],
      b = [],
      s = [];
    const indices = [];
    for (const parent of m.listParents()) {
      if (parent.propertyType === 'Primitive') {
        if (!parent.getIndices()) {
          console.log('no indices');
          continue;
        }
        if (parent.getAttribute('_batchid')) {
          b.push(parent.getAttribute('_batchid').getArray());
        }
        if (parent.getAttribute('_status')) {
          s.push(parent.getAttribute('_status').getArray());
        }
        p.push(parent.getAttribute('POSITION').getArray());
        // 没有贴图仍应保留法线数据
        if (normal && parent.getAttribute('NORMAL')) { n.push(parent.getAttribute('NORMAL').getArray()); }
        // if (m.getName().includes('HuoJian1') || m.getName().includes('lambert24SG.001')) { n.push(parent.getAttribute('NORMAL').getArray()); }
        // 没有贴图的时候不复制 UV 数据
        if (hasTextures(m)) {
          if (parent.getAttribute('TEXCOORD_0')) t.push(parent.getAttribute('TEXCOORD_0').getArray());
          if (parent.getAttribute('TEXCOORD_1')) t1.push(parent.getAttribute('TEXCOORD_1').getArray());
        }
        indices.push({ index: parent.getIndices().getArray(), len: parent.getAttribute('POSITION').getCount() });
      }
    }
    if (!indices.length) {
      console.log('not used material', m.getName());
      continue;
    }
    // console.log(p,p.length);
    const mergedPrim = newDoc.createPrimitive()
      .setMode(Primitive.Mode.TRIANGLES)
      .setMaterial(material)
      .setAttribute('POSITION', flattenArray(newDoc, 'VEC3', p));
    if (b.length) { mergedPrim.setAttribute('_batchid', flattenCustomArray(newDoc, 'SCALAR', b)); }
    if (s.length) { mergedPrim.setAttribute('_status', flattenCustomArray(newDoc, 'SCALAR', s)); }
    if (n.length) { mergedPrim.setAttribute('NORMAL', flattenArray(newDoc, 'VEC3', n)); }
    if (t.length) { mergedPrim.setAttribute('TEXCOORD_0', flattenArray(newDoc, 'VEC2', t)); }
    if (t1.length) { mergedPrim.setAttribute('TEXCOORD_1', flattenArray(newDoc, 'VEC2', t1)); }

    mergedPrim.setIndices(flattenIndex(newDoc, indices));

    mergedPrim.listAttributes()
      .forEach((attribute) => {
        attribute.setBuffer(buffer);
      });

    const mergedMesh = newDoc.createMesh('MergedMesh_' + m.getName()).addPrimitive(mergedPrim);
    const mergedNode = newDoc.createNode('MergedNode_' + m.getName()).setMesh(mergedMesh);
    newDoc.getRoot().getDefaultScene().addChild(mergedNode);

  }
}





function checkIdentityMatrix(matrix) {
  for ( i = 0; i < matrix.length; i++)
  for ( j = 0; j < matrix[i].length; j++) {
    if ((i == j && matrix[i][j] != 1) || (i != j && matrix[i][j] != 0)) return false;
  }
  return true;
}

module.exports = {
  flattenArray,
  flattenIndex,
  copyMaterial,
  mergeByMaterial,
  checkIdentityMatrix
};
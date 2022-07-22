const { Document, NodeIO, Accessor, BufferUtils, Primitive,bounds } = require('@gltf-transform/core');
const { Box3, Vector3 } = require("three")

BufferUtils.trim = (buffer) => {
  const { byteOffset, byteLength } = buffer;
  return buffer.buffer.slice(byteOffset, byteOffset + byteLength);
}


function flattenArray(newDoc, type, arrays) {
  const array = new Float32Array(BufferUtils.concat(arrays));
  return newDoc.createAccessor().setType(type).setArray(array);
}

function flattenCustomArray(newDoc, type, arrays) {
  const array = new Uint32Array(BufferUtils.concat(arrays));
  return newDoc.createAccessor().setType(type).setArray(array);
}

function flattenIndex(newDoc, arrays) {
  let length = 0;
  // console.log(arrays);
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
  // console.log(array);
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
    // if (!(m instanceof Material)) {
    //   break;
    // }
    const material = newDoc.createMaterial(m.getName());
    try {
      copyMaterial(newDoc, m, material);
    } catch (err) {
      console.log(err);
    }
    // 同Materials且同Attribute才能合并
    const nodeMap = new Map();
    class MyAttribute {
      p = []
      n = []
      t = []
      t1 = []
      b = []
      s = []
      indices = []
    }
    for (const parent of m.listParents()) {
      if (parent.propertyType === 'Primitive') {
        if (!parent.getIndices()) {
          console.log('no indices');
          continue;
        }
        const attList = [];
        parent.listSemantics().sort().forEach(value => {
          if (
            value === '_batchid'
            || value === '_status'
            || value === 'POSITION'
            || value === 'NORMAL'
            || value === 'TEXCOORD_0'
            || value === 'TEXCOORD_1'
          ) {
            attList.push(value);
          }
        });
        const key = attList.toString();
        const obj = nodeMap.get(key) || new MyAttribute();
        if (parent.getAttribute('_batchid')) {
          obj.b.push(parent.getAttribute('_batchid').getArray());
        }
        if (parent.getAttribute('_status')) {
          obj.s.push(parent.getAttribute('_status').getArray());
        }
        obj.p.push(parent.getAttribute('POSITION').getArray());

        // 没有贴图仍应保留法线数据
        // if (normal && parent.getAttribute('NORMAL')) { obj.n.push(parent.getAttribute('NORMAL').getArray()); }
        // if (m.getName().includes('HuoJian1') || m.getName().includes('lambert24SG.001')) { n.push(parent.getAttribute('NORMAL').getArray()); }
        // 没有贴图的时候不复制 UV 数据
        if (hasTextures(m)) {
          if (parent.getAttribute('TEXCOORD_0')) obj.t.push(parent.getAttribute('TEXCOORD_0').getArray());
          if (parent.getAttribute('TEXCOORD_1')) obj.t1.push(parent.getAttribute('TEXCOORD_1').getArray());
        }
        obj.indices.push({ index: parent.getIndices().getArray(), len: parent.getAttribute('POSITION').getCount() });
        nodeMap.set(key, obj);
      }
    }
    let i = 0;
    nodeMap.forEach(obj => {
      const { p, n, t, t1, b, s, indices } = obj;
      if (!indices.length) {
        console.log('not used material', m.getName());
        return;
      }
      const mergedPrim = newDoc.createPrimitive()
        .setMode(Primitive.Mode.TRIANGLES)
        .setMaterial(material)
        .setAttribute('POSITION', flattenArray(newDoc, 'VEC3', p));
      if (b.length) {
         mergedPrim.setAttribute('_batchid', flattenCustomArray(newDoc, 'SCALAR', b)); 
        }
      if (s.length) { mergedPrim.setAttribute('_status', flattenCustomArray(newDoc, 'SCALAR', s)); }
      if (n.length) { mergedPrim.setAttribute('NORMAL', flattenArray(newDoc, 'VEC3', n)); }
      if (t.length) { mergedPrim.setAttribute('TEXCOORD_0', flattenArray(newDoc, 'VEC2', t)); }

      if (t1.length) { mergedPrim.setAttribute('TEXCOORD_1', flattenArray(newDoc, 'VEC2', t1)); }
      console.log("indices.length",indices.length);
      mergedPrim.setIndices(flattenIndex(newDoc, indices));
      mergedPrim.listAttributes()
        .forEach((attribute) => {
          attribute.setBuffer(buffer);
          
        });

      const mergedMesh = newDoc.createMesh('MergedMesh_' + m.getName() + i).addPrimitive(mergedPrim);
      const mergedNode = newDoc.createNode('MergedNode_' + m.getName() + i).setMesh(mergedMesh);
      newDoc.getRoot().getDefaultScene().addChild(mergedNode);
      i++;
    });

  }
}





function checkIdentityMatrix(matrix) {
  for ( i = 0; i < matrix.length; i++)
  for ( j = 0; j < matrix[i].length; j++) {
    if ((i == j && matrix[i][j] != 1) || (i != j && matrix[i][j] != 0)) return false;
  }
  return true;
}


function fullName(p) {
  let tr = p;
  let name = p.getName();
  while (tr.listParents().length) {
    name = tr.getName() + name;
    if (tr.listParents()[0].propertyType !== 'Root') {
      tr = tr.listParents()[0];
    } else if (tr.listParents()[1]) {
      tr = tr.listParents()[1];
    } else {
      break;
    }
  }
  return name;
}

function cleanName(name) {
  if (name.lastIndexOf('(') > 0) {
    return name.substring(0, name.lastIndexOf('(')).trim();
  } else {
    return name;
  }
}

function extractElementInfo(p) {
  let tr = p;

  const hierarchy = [];
  if (p.getName()) hierarchy.unshift(cleanName(p.getName()));
  while (tr.listParents().length) {
    const nodeName = tr.getName();
    if (nodeName) hierarchy.unshift(cleanName(nodeName));
    if (tr.listParents()[0].propertyType !== 'Root') {
      tr = tr.listParents()[0];
    } else if (tr.listParents()[1]) {
      tr = tr.listParents()[1];
    } else {
      break;
    }
  }
  const name = hierarchy.pop();
  return { hierarchy, name, elementId: name };
}

function extractSimlabInfo(p) {
  let tr = p;

  const hierarchy = [];
  if (p.getName()) hierarchy.unshift(cleanName(p.getName()));
  let id = 0;
  while (tr.listParents().length) {
    const nodeName = tr.getName();
    if (nodeName) hierarchy.unshift(cleanName(nodeName));
    if (tr.listParents()[0].propertyType !== 'Root') {
      tr = tr.listParents()[0];
    } else if (tr.listParents()[1]) {
      tr = tr.listParents()[1];
    } else {
      break;
    }
  }
  let name;
  while (hierarchy.length) {
    name = hierarchy.pop();
    if (name.includes('[')) {
      id = name.substring(name.indexOf('[') + 1, name.indexOf(']'));
      break;
    }
  }
  name = name.substring(0, name.lastIndexOf('[')).trim();
  return { hierarchy, name, elementId: id };
}






function allProgress(proms, progress_cb) {
  let d = 0;
  progress_cb(0);
  for (const p of proms) {
     p.then(() => {
        d++;
        progress_cb((d * 100) / proms.length);
     })
        .catch(() => {
           d++;
           progress_cb((d * 100) / proms.length);
        })
  }
  return Promise.all(proms);
}



function get_bounding_box_by_doc(doc) {
  const scene = doc.getRoot().listScenes()[0];
  const sceneBounds = bounds(scene);
  return new Box3(new Vector3(...sceneBounds.min), new Vector3(...sceneBounds.max));
}





function getEuler(out, quat) {
  let x = quat[0],
    y = quat[1],
    z = quat[2],
    w = quat[3],
    x2 = x * x,
    y2 = y * y,
    z2 = z * z,
    w2 = w * w;
  let unit = x2 + y2 + z2 + w2;
  let test = x * w - y * z;
  if (test > 0.499995 * unit) { //TODO: Use glmatrix.EPSILON
    // singularity at the north pole
    out[0] = Math.PI / 2;
    out[1] = 2 * Math.atan2(y, x);
    out[2] = 0;
  } else if (test < -0.499995 * unit) { //TODO: Use glmatrix.EPSILON
    // singularity at the south pole
    out[0] = -Math.PI / 2;
    out[1] = 2 * Math.atan2(y, x);
    out[2] = 0;
  } else {
    out[0] = Math.asin(2 * (x * z - w * y));
    out[1] = Math.atan2(2 * (x * w + y * z), 1 - 2 * (z2 + w2));
    out[2] = Math.atan2(2 * (x * y + z * w), 1 - 2 * (y2 + z2));
  }
  // TODO: Return them as degrees and not as radians
  return out;
}
module.exports = {
  getEuler,
  flattenArray,
  flattenIndex,
  copyMaterial,
  mergeByMaterial,
  checkIdentityMatrix,
  allProgress,
  get_bounding_box_by_doc
};

const { Measure } = require('./src/tile');
const { Slicer } = require('./src/slicer');
const { Tile } = require('./src/tile');
const { Tileset } = require('./src/tileset');
const { Box3, Matrix4, Sphere, Vector3 } = require("three");

const { BVH } = require('./src/BVH.js');

const fs = require('fs');


function bvhToTileset(bvh) {
  //完全二叉树结构
  // 最低层级每两个tile一组，可能只有一个tile
  const root = bvh[0];
  // 获取每层级数组
  const maxLevel = Math.max(...bvh.map(node => node.level).filter(level => level));

  const levelArr = Array.from(Array(maxLevel + 1),
    (i, level) => bvh.filter(node => node.level === level));
  // 
  const rootTile = new Tile({
    "instances_matrices": new Matrix4(),
    "matrix": new Matrix4(),
    box: root.boundingBox,
    refine: "ADD",
  })


  const tileset = new Tileset(rootTile);
  const addChildren = (tiles, level) => {
    if (level === maxLevel) {
      return;
    }
    const children = levelArr[level + 1];

    const childrenToTiles = (children) => {
      const tiles = Array.from(children, (child, id) => {
        const tile = child?.tile ? child.tile : new Tile({
          "instances_matrices": new Matrix4(),
          "matrix": new Matrix4(),
          box: child.boundingBox,
        })
        return tile;
      });
      return tiles;
    }

    // 取出两个子tile，添加到父tile的children中
    // 如果不是偶数个，则最后一个子tile 添加到最后一个tile的children中 
    if (level === 0) {
 
      tiles[0].add_children(childrenToTiles(children));
    } else {
      // traval tiles add children
      tiles.forEach((tile, id) => {
        const child = children[id * 2];
        const child2 = children[id * 2 + 1];
        const tiles =childrenToTiles( [child, child2].filter(child => child));
        tile.add_children(tiles);
      }
      );

    }
    addChildren(tiles.map(tile=>tile.children).flat(), level + 1);
  }


  addChildren([rootTile], 0);
  return tileset;
}

async function gltf_to_tileset(gltf, fout, measure = Measure.METER) {

  try {


    var gltf_slicer, groupped_tiles, root, tiles, tileset;
    // step1 分割 gltf(s),按材质合并，成不同的mesh

    gltf_slicer = new Slicer(gltf);

    await gltf_slicer.splitMesh();
    Tile.measure = Measure.FOOT;

    // step2 分割 mesh 到 tile,每个mesh为一个 tile(内容为glb/b3dm)
    // （ 可优化分割为多个，如果外包盒太大）
    // （ 可优化对mesh分层简化）
    // （ 可优化过小的 mesh 合并为 cmpt）
    console.log("meshes_count", gltf_slicer.meshes_count());

    tiles = Array.from({
      length: gltf_slicer.meshes_count()
      // length: 5
    }, (item, id) => {
      return new Tile({
        fout,
        "content_id": id,
        "instance_box": gltf_slicer.get_bounding_box_by_mesh(id),
        "instances_matrices": gltf_slicer.get_mesh_matrices(id),
        "matrix": new Matrix4(),
        "gltf": gltf_slicer.documents[id]//按mesh分割成小的 gltf
      });
    });
    // step3 分割 tile 到 group,每个group为一个 tile(内容为glb/b3dm)
    // （ 可优化分割为多个，如果外包盒太大）



    const bvh = new BVH(tiles);
    fs.writeFileSync("./models/bvh.json", JSON.stringify(bvh, null, 2));



    tileset = bvhToTileset(bvh.bvh);



    fs.writeFileSync(fout + "tileset.json", JSON.stringify(tileset, null, 2));
  } catch (error) {
    console.log(error);
  }
}
module.exports = {
  gltf_to_tileset
}
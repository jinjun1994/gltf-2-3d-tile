



class Tileset {

  constructor(root) {
    this.root = root;
  }

  get geometric_error() {
    return this.root.geometric_error;
  }

  toJSON() {
    return {
      "asset": {
        "version": "1.0",
        "tilesetVersion": "1.0.0.0",
        "gltfUpAxis":"Z"
        //[3D Tiles - Specify glTF up-axis in tileset.json by lilleyse · Pull Request #5005 · CesiumGS/cesium](https://github.com/CesiumGS/cesium/pull/5005)
        // gltf默认是y轴，而我们的tile是z轴，所以需要指定
      },
      "geometricError": this.geometric_error,
      "root": this.root
    };
  }

}

module.exports = {Tileset};
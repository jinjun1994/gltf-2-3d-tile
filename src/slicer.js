const { splitGltf } = require('../tools/split-mesh');
const { instanceDoc } = require('../functions/instance');
const {
    bounds,
} = require('@gltf-transform/core');
const { Box3, Matrix4, Sphere, Vector3 } = require("three")

class Slicer {
    constructor(gltf) {
        this.gltf = gltf;


        this.root = this.gltf.getRoot();
    }
    async splitMesh() {
        this.documents = await splitGltf(this.gltf);
    }
    get_bounding_box_by_mesh(mesh_id) {
       return this.documents[mesh_id].bounding_box;
    }




    get_mesh_matrices(mesh_id) {
        return new Matrix4();
    }
    meshes_count() {
        // return this.root.listMeshes().length;
        return this.documents.length;
    }
}
module.exports = {
    Slicer
}
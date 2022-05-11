const { splitGltf } = require('../tools/split-mesh');
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
        const doc = this.documents[mesh_id];
        const scene = doc.getRoot().listScenes()[0];
        const sceneBounds = bounds(scene);
        return new Box3(new Vector3(...sceneBounds.min), new Vector3(...sceneBounds.max));
    }




    get_mesh_matrices(mesh_id) {
        return new Matrix4();
    }
    meshes_count() {
        return this.root.listMeshes().length;
    }
}
module.exports = {
    Slicer
}
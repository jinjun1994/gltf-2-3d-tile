const FOOT_TO_METER_MULTIPLIER = 0.3084
const glbToB3dm = require('../tools/glbToB3dm');
const doc2I3dm = require('../tools/docToI3dm');
const { Box3, Matrix4, Sphere, Vector3 } = require("three")
const { Document, NodeIO, Accessor, BufferUtils, Primitive } = require('@gltf-transform/core');
var fsExtra = require('fs-extra');
const { checkIdentityMatrix } = require('../tools/utils');
class Measure {
    METER = "meter"
    FOOT = "foot"
}



class Tile {
    "measure" = Measure.METER
    constructor({
        content_id = null,
        refine = null,
        matrix = new Matrix4(),
        box = new Box3(),
        instance_box = new Box3(),
        instances_matrices = null,
        gltf = null,
        fout = "./"
    } = {}) {
        this.refine = refine;
        this.__content_id = content_id;
        this.__matrix = matrix.clone();
        this.__content_matrices = instances_matrices;
        this.__instance_box = instance_box;
        this.__box = box.clone();
        this.__children = [];
        this.__gltf = gltf;
        this.fout = fout;

    }

    add_child(tile) {
        if (!tile) {
            return this;
        }

        this.__children.push(tile);

        this.__box.union(tile.box_world());

        return this;
    }

    add_children(children) {
        if (!children) {
            return this;
        }

        for (var child, _pj_c = 0, _pj_a = children, _pj_b = _pj_a.length; _pj_c < _pj_b; _pj_c += 1) {
            child = _pj_a[_pj_c];
            this.add_child(child);
        }

        return this;
    }

    add_content_matrix(matrix) {
        this.__content_matrices.push(matrix);
    }
    content() {
        const io = new NodeIO()

        const { doc, type, name,featureTableJson } = this.__gltf
        const fileName = name||this.__content_id
        if (type === "i3dm") {


            io.writeBinary(doc).then(glb => {

               doc2I3dm(glb, {customFeatureTable:featureTableJson}).then(i3dm => {
                fsExtra.outputFile(`${this.fout + fileName}.i3dm`, i3dm.i3dm)
                })
          
            })
            return {
                "uri": `${fileName}.i3dm`
            }
        } else {
            // TODO:
            // return new B3dm(this.__content_id.toString(), this.__gltf);
            // TODO:
            // 输出目录传参？ 
            // b3dm 优化
            io.writeBinary(this.__gltf).then(glb => {

                fsExtra.outputFile(`${this.fout + this.__content_id}.b3dm`, glbToB3dm(glb))
                fsExtra.outputFile(`${this.fout + this.__content_id}.glb`, glb)
            })

            return {
                "uri": `${this.__content_id}.b3dm`
            }
        }
    }
    __content_matrix() {
        if (this.__content_matrices && 1 === this.__content_matrices.length) {
            return this.__content_matrices[0];
        }

        return new Matrix4();
    }
    __content_box() {
        var box;
        box = new Box3();
        if (1 < this.__content_matrices.length) {
            for (var matrix, _pj_c = 0, _pj_a = this.__content_matrices, _pj_b = _pj_a.length; _pj_c < _pj_b; _pj_c += 1) {
                matrix = _pj_a[_pj_c];
                box.union(this.__instance_box.clone().applyMatrix4(matrix.matrix));
            }

            return box;
        }

        return this.__instance_box;
    }
    size() {
        return this.box.size;
    }

    centroid() {
        return this.box.center;
    }

    matrix() {
        return this.__matrix.clone().multiply(this.__content_matrix());
    }

    apply_matrix4(matrix) {
        this.__matrix.premultiply(matrix);

        return this;
    }

    get children() {
        return this.__children;
    }

    box() {
        // console.log("this.__content_id",this.__content_id);
        // console.log("this.__box",this.__box);
        // console.log("this.__content_box()",this.__content_box());
        // console.log("this.__box.clone().union(this.__content_box())",this.__box.clone().union(this.__content_box()));
        if (this.box_cache) {
            return this.box_cache
        }
        return this.box_cache = this.__content_id === null ? this.__box : this.__box.clone().union(this.__content_box());
    }
    centroid_world() {
        if (this.centroid_world_cache) {
            return this.centroid_world_cache
        }
        return this.centroid_world_cache = this.box_world().getCenter(new Vector3()).toArray()
    }

    box_world() {
        if (this.box_world_cache) {
            return this.box_world_cache
        }
        return this.box_world_cache = this.box().clone().applyMatrix4(this.matrix());
    }
    geometric_error() {
        if (this.__content_id === null) {
            return Math.max(...this.__children.map(tile => {
                return tile.geometric_error();
            }
            ));
        }
        const diagonal = this.__instance_box.min.distanceTo(this.__instance_box.max);
        if (Tile.measure === Measure.FOOT) {
            return diagonal * FOOT_TO_METER_MULTIPLIER;
        }

        return diagonal;
    }
    toJSON() {
        var ret;
        const [width, height, depth] = this.box().getSize(new Vector3()).toArray()
        ret = {
            "boundingVolume": {
                "box": [
                    ...this.box().getCenter(new Vector3()).toArray(),
                    width / 2, 0, 0,
                    0, height / 2, 0,
                    0, 0, depth / 2
                ]
            },
            "geometricError": this.geometric_error(),
            "refine": this.refine
        };
        if (!checkIdentityMatrix(this.matrix().toArray)) {
            ret["transform"] = this.matrix().toArray();
        }

        if (this.__content_id !== null) {
            ret["content"] = this.content();
        }

        if (this.children) {
            ret["children"] = function () {
                var _pj_a = [],
                    _pj_b = this.children;

                for (var _pj_c = 0, _pj_d = _pj_b.length; _pj_c < _pj_d; _pj_c += 1) {
                    var child = _pj_b[_pj_c];

                    _pj_a.push(child.toJSON());
                }
                return _pj_a.length === 0 ? null : _pj_a;
            }.call(this);
        }
        // return ret not None

        return Object.fromEntries(Object.entries(ret).filter(([key, value]) => {
            return value !== null
        }))
        //    return {k: v for k, v in ret.items() if v is not None}
    }
}


module.exports = {
    Measure,
    Tile
}

// 算法实现说明： https://banbao991.github.io/2022/04/11/CG/Papers/2021/bvh-survey-2/
count_level_20 = 0;

const count_set_bits = (x) => {
    res = 0;
    for (let i = 0; i < 32; i++) {
        if (x & 0x1 == 1) res++;
        x >>= 1;
    }
    return res;
}

class BVHNode {
    tile; //物体
    boundingBox;
    level;
    constructor() { }

    findBondingBoxByTile() {
        //通过本身的物体来计算自己的包围盒
        this.boundingBox = this.tile.box_world()

    }
    findBondingBoxByNodes(BVHNode1, BVHNode2) {
        // 通过两个子节点来计算自己的包围盒
        this.boundingBox = BVHNode1.boundingBox.union(BVHNode2.boundingBox)
    }
    findBondingBoxByNode(BVHNode) {
        //设置自己的包围盒为另一个节点的包围盒
        this.boundingBox = BVHNode.boundingBox || BVHNode.findBondingBoxByTile()

    }
    findMax() { }
    findMin() { }
};


class BVH {

    bvh;
    constructor(tiles) {
        this.bvh = this.buildBVH(tiles);
        console.log("Build BVH success");
    }
    buildBVH(tiles) {
        let t = tiles.length;  //总tile数
        let Lc = Math.pow(2, Math.ceil(Math.log2(tiles.length)));             //叶节点的个数
        let Lv = Lc - t;                                      //虚叶节点的个数
        let Nc = 2 * Lc - 1;//总节点数
        let Nv = 2 * Lv - count_set_bits(Lv);//总虚节点数
        let Nr = 2 * t - 1 + count_set_bits(Lv); //总实节点数
        let Level = Math.floor(Math.log2(Nc));   //最大层数
        console.log("Total real = " + Nr);
        let bvh = Array.from(Array(Nc), () => new BVHNode());



        for (let l = Level; l >= 0; l--) {
            let current_level_v = Lv >> (Level - l);
            let start = Math.pow(2, l) - 1, end = Math.pow(2, l + 1) - 1 - current_level_v;
            let k = 0;

            const findIndex = (i, l) => {
                let Lvl = Lv >> (Level - l + 1);
                let Nvl = 2 * Lvl - count_set_bits(Lvl);
                return i - Nvl;
            }
            console.log("start,end", start, end - 1);
            for (let i = start; i < end; i++) {




                const node = bvh[findIndex(i, l)]

                if (l == Level) {
                    //叶节点

                    node.tile = tiles[k];
                    node.findBondingBoxByTile(tiles[k]);
                    node.level = l;
                    k++;
                }
                else {
                    node.tile = null;
                    if (this.haveRightSubtree(i, l, Lv, Level)) {
                        node.findBondingBoxByNodes(bvh[findIndex(2 * i + 1, l + 1)], bvh[findIndex(2 * i + 2, l + 1)]);
                        node.level = l;
                    }
                    else {
                        //右子树缺失
                        node.findBondingBoxByNode(bvh[findIndex(2 * i + 1, l + 1)]);
                        node.level = l;
                    }

                }
            }
            console.log("level ", l, "build successfully");
        }
        return bvh
    }
    haveRightSubtree(bvh, l, Lv, Level) {
        if (2 * bvh + 2 >= Math.pow(2, l + 2) - 1 - (Lv >> (Level - l - 1))) {
            return false;
        }
        else return true;
    }
    destroy() {
        this.bvh = NULL;
    }



};

module.exports = {
    BVH
}
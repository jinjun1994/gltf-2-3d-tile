

## 步骤：

1 扁平化gltfs  
2 按材质合并  
3 按材质切分为不同的mesh
 3.0 每个mesh为一个 tile(内容为glb/b3dm)
 3.1 过小的多个合并成一个cmpt
 3.2 tile  
4 计算tile分组 (计算父子关系，能被某tile包含认为是父子关系))  
5 构建BVH
 5.2 不同层级简化子节点mesh  
6 输出 tileset


node --stack-size=100000 --max-old-space-size=16000 lib.js 

TODO:
1. 位置不同一样的mesh如椅子，会生成多个，进行简化处理
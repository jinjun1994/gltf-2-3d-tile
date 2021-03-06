const { dedup, inspect, utils,prune,weld } = require('@gltf-transform/functions');
const { InstancedMesh, MeshGPUInstancing } = require('@gltf-transform/extensions');
const { Quaternion, Euler } = require("three")
const { allProgress, get_bounding_box_by_doc,getEuler } = require('../tools/utils');
const Piscina = require('piscina');
const path = require('path');
const { cpus } = require('os');
const ext = require('@gltf-transform/extensions');
var fsExtra = require('fs-extra');
const filenamify = require("filenamify");
const {vec3,mat4,quat} = require('gl-matrix');
const { multiply } = require( 'gl-matrix/mat4');
const { mergeByMaterial } = require('../tools/utils');
const mergeGltfs = require('../tools/merge-gltfs');
const {exec} = require('./gltfTransform');

const {
	Accessor,
	Document,
	ExtensionProperty,
	MathUtils,
	GLTF,
	ImageUtils,
	Texture,
	NodeIO,
	TypedArray,
	bounds,
	Node,
	PropertyType,
} = require('@gltf-transform/core');
const io = new NodeIO().registerExtensions(ext.KHRONOS_EXTENSIONS);

const piscina = new Piscina({
	minThreads: cpus().length,
	filename: path.resolve(__dirname, 'worker.js')

});


module.exports = {
	instanceDoc,
}

async function instanceDoc(doc) {
	// 
	console.log("object");

	// const meshes = inspect(doc).meshes
	// const meshes = listMeshes(doc)
	// const InstancedMesh = meshes.filter(mesh => mesh.instances > 1);
	const newDoc = doc.clone();
	return instance(newDoc);
}


const MeshPrimitiveModeLabels = [
	'POINTS',
	'LINES',
	'LINE_LOOP',
	'LINE_STRIP',
	'TRIANGLES',
	'TRIANGLE_STRIP',
	'TRIANGLE_FAN',
];
/** List meshes. */
function listMeshes(doc) {
	console.log("object");
	console.log(doc
		.getRoot()
		.listMeshes().length);
	const meshes = doc
		.getRoot()
		.listMeshes()
		.map((mesh, index) => {
			try {



				const instances = mesh.listParents().filter((parent) => parent.propertyType !== PropertyType.ROOT).length;


				let verts = 0;
				const semantics = new Set();
				const meshIndices = new Set();
				const meshAccessors = new Set();

				mesh.listPrimitives().forEach((prim) => {
					for (const semantic of prim.listSemantics()) {
						const attr = prim.getAttribute(semantic);
						semantics.add(semantic + ':' + arrayToType(attr.getArray()));
						meshAccessors.add(attr);
					}
					for (const targ of prim.listTargets()) {
						targ.listAttributes().forEach((attr) => meshAccessors.add(attr));
					}
					const indices = prim.getIndices();
					if (indices) {
						meshIndices.add(arrayToType(indices.getArray()));
						meshAccessors.add(indices);
					}
					verts += prim.listAttributes()[0].getCount();
				});

				let size = 0;
				Array.from(meshAccessors).forEach((a) => (size += a.getArray().byteLength));

				const modes = mesh.listPrimitives().map((prim) => MeshPrimitiveModeLabels[prim.getMode()]);

				return {
					mesh,
					name: mesh.getName(),
					mode: Array.from(new Set(modes)),
					primitives: mesh.listPrimitives().length,
					vertices: verts,
					indices: Array.from(meshIndices).sort(),
					attributes: Array.from(semantics).sort(),
					instances: instances,
					size: size,
				};
			} catch (error) {
				console.log(error);
			}
		});


	return meshes;

}

function arrayToType(array) {
	return array.constructor.name.replace('Array', '').toLowerCase();
}


const NAME = 'instance';

/**
 * Creates GPU instances (with `EXT_mesh_gpu_instancing`) for shared {@link Mesh} references. No
 * options are currently implemented for this function.
 */
async function instance(doc) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars



	const logger = doc.getLogger();
	const root = doc.getRoot();
	const batchExtension = doc.createExtension(MeshGPUInstancing);

	if (root.listAnimations().length) {
		throw new Error(`${NAME}: Instancing is not currently supported for animated models.`);
	}

	let numBatches = 0;
	let numInstances = 0;
	const i3dms = [];
	const b3dms = [];
    let currentBatchId = 0;
	for (const scene of root.listScenes()) {
		// Gather a one-to-many Mesh/Node mapping, identifying what we can instance.
		const meshInstances = new Map();
		scene.traverse((node) => {
			const mesh = node.getMesh();
			if (!mesh) return;
			meshInstances.set(mesh, (meshInstances.get(mesh) || new Set()).add(node));
		});

		// For each Mesh, create an InstancedMesh and collect transforms.
		const modifiedNodes = [];
		for (const mesh of Array.from(meshInstances.keys())) {


			const batchTableJson = {
				batchId: [],
				name: [],
				maxPoint: [],
				minPoint: []
			}
			const nodes = Array.from(meshInstances.get(mesh));

		// if( Math.random()<0.95&& nodes.filter(n=>n.getName().includes("byc")||n.getName().includes("BYC")||n.getName().includes("BY")).length<1) continue
		// if(nodes.filter(n=>n.getName().includes("byc")||n.getName().includes("BYC8-3900*3200")).length<1) continue

			// not instance mesh : all merge by material then  split to  b3dm
			if (nodes.length < 2) {

				

				const node = nodes[0];
	
			let	worldMatrix = node.getWorldMatrix()
			let	localMatrix = node.getMatrix()
			let	localT = node.getTranslation()
			let	localR = node.getRotation()
			let	lpcalS = node.getScale()
               batchTableJson.batchId.push(currentBatchId)
			   batchTableJson.name.push(node.getName())
	
			   fsExtra.outputFile(`./tmp/${filenamify(mesh.getName())}.b3dm.json`, JSON.stringify({TRANSFORMATIONS:{
				localT,
				localR,
				lpcalS,
				localMatrix,
				worldMatrix
			},...batchTableJson}))        

				b3dms.push({
					type: "b3dm",
					mesh,
					batchTableJson,
					TRANSFORMATIONS:{
						worldMatrix,
						localT,
						localMatrix,
						localR,
						lpcalS,
					}
				})
				currentBatchId++;
				continue
			};
			if (nodes.some((node) => node.getSkin())) continue;

			const featureTableJson = {
				position: [],
				orientation: [],
				scale: []
			}
			// For each Node, write TRS properties into instance attributes.
			for (let i = 0; i < nodes.length; i++) {
				let t = vec3.create(), r= quat.create(), s= vec3.create();
				const node = nodes[i];
				const matrix = node.getWorldMatrix();
	
				const nodeMat4 = mat4.fromValues(...matrix);
				// mat4.translate(nodeMat4, nodeMat4, [100,100,100]);
				t = mat4.getTranslation(t,nodeMat4)
				r = mat4.getRotation(r,nodeMat4)
				s = mat4.getScaling(s,nodeMat4)
                
				const rEuler = [0,0,0]
				getEuler(rEuler,r)
				// console.log(rEuler);
				if(node.getName()=="BYC8-3900*3200"){

			
				}
				{
					//i3dm
					featureTableJson.position.push([t[0],t[1],t[2]])
					var quaternion = new Quaternion().fromArray(r);
					const euler = new Euler().setFromQuaternion(quaternion.normalize());

					featureTableJson.orientation.push([euler.x, euler.y, euler.z].map(e=>e*180/Math.PI));
					featureTableJson.scale.push([s[0],s[1],s[2]])

		        	// i3dm ?????????mesh?????????????????????

					batchTableJson.batchId.push(currentBatchId)
					batchTableJson.name.push(node.getName())
    				currentBatchId++;
 
				}
			}



			numBatches++;
			numInstances += nodes.length;

			fsExtra.outputFile(`./tmp/${filenamify(mesh.getName())}.json`, JSON.stringify({...featureTableJson,...batchTableJson}))        

			{
				//i3dm 
				i3dms.push({
					type: "i3dm",
					mesh,
					batchTableJson,
					featureTableJson
				})
				// console.log(featureTableJson);
				// I3dmBatchTable.json
				//{
				// "name":["center","right","left","top","bottom","up","right-top","right-bottom","left-top","left-bottom"],
				// "id":[0,1,2,3,4,5,6,7,8,9]
				// }
				// I3dmfeatureTable.json
				// {"position":[[0,0,0],[20,0,0],[-20,0,0],[0,20,0],[0,-20,0],[0,0,20],[20,20,0],[20,-20,0],[-20,20,0],[-20,-20,0]],
				// "orientation":[[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
				// "scale":[[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1]]}
				//?????????????????? https://github.com/PrincessGod/objTo3d-tiles/blob/181b186e2b3bddad0bd5d7857811f29b768f3406/lib/obj2I3dm.js#L160


			}
		}
	}

	if (numBatches > 0) {
		logger.info(
			`${NAME}: Created ${numBatches} batches, with ${numInstances} total instances.`
		);
		logger.info(
			`${NAME}: Created ${b3dms.length} b3dm, with ${b3dms.length} total instances.`
		);
	} else {
		logger.info(`${NAME}: No meshes with multiple parent nodes were found.`);
		batchExtension.dispose();
	}

	logger.debug(`${NAME}: Complete.`);

     let index = -1;
const 	 array = []
 	for (const {type, mesh,TRANSFORMATIONS,featureTableJson,batchTableJson } of [...i3dms,...b3dms]) {
        index++;

		const newDoc = doc.clone();

		console.log(`newDoc ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`);
        let length
		console.log(length= newDoc.getRoot().listMeshes().filter(m => m.getName() == mesh.getName()).length);
		if(length>1)throw new Error(`${mesh.getName()} ????????????`)
		const curentMesh = newDoc.getRoot().listMeshes().filter(m => m.getName() == mesh.getName())[0];

		const oldScene = newDoc.getRoot().getDefaultScene();
		oldScene.dispose();
		const scene = newDoc.createScene();
		newDoc.getRoot().setDefaultScene(scene);
		const node = newDoc.createNode(mesh.getName());
		node.setMesh(curentMesh);
		if(TRANSFORMATIONS){
			// node.setTranslation(TRANSFORMATIONS.localT);
			// node.setRotation(TRANSFORMATIONS.localR);
			// node.setScale(TRANSFORMATIONS.lpcalS);
			const matrix = TRANSFORMATIONS.worldMatrix;
			// multiply(matrix, matrix, TRANSFORMATIONS.localMatrix);
			curentMesh.listPrimitives().forEach((primitive) => {
		
				const count = primitive.getAttribute('POSITION').getCount();
				for (let i = 0; i < count; i++) {
				  const target = [0, 0, 0];
				  primitive.getAttribute('POSITION').getElement(i, target);
				  const res = vec3.create();
				  vec3.transformMat4(
					res,
					vec3.fromValues(...target),
					matrix
				  );
				  primitive.getAttribute('POSITION').setElement(i, res);
				}
			});
	
		}
		scene.addChild(node);
		newDoc.getRoot().listNodes().forEach(element => {
			if (node != element) element.dispose();
		});



		const name = mesh.getName();
		//[Possibility to specify name for .bin files emmited from partition command? ?? Discussion #412 ?? donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform/discussions/412)
		newDoc.getRoot().listBuffers()[0].setURI(name + '.bin');

		console.log(index);
		console.log(name);

		{
			if(type==="b3dm"){
			
				curentMesh.listPrimitives().forEach((primitive) => {
				// primitive.setAttribute("batchId", index);
				// primitive.getAttribute("position").getMax()
				// primitive.getAttribute("position").getMin()
				const count = primitive.getAttribute('POSITION').getCount();
				const accessor = newDoc
				.createAccessor()
				.setType(Accessor.Type.SCALAR);
			  let array 
			  const _batchId = batchTableJson.batchId[0];

			  if (_batchId < 256) {
				array = new Uint8Array(count);
			} else if (_batchId < 65536) {
				array = new Uint16Array(count);
	
			} else {
				array = new Uint32Array(count);
			
			}
			  
			  array.fill(_batchId);
			  accessor.setArray(array);
			  primitive.setAttribute('_batchid', accessor);

			});
			}
		}
		const meshDoc =await newDoc.transform(prune())

		const docPath = `./tmp/${filenamify(name.replace("/", ""))}.${type}.glb`
		const glb = await io.writeBinary(meshDoc)
		await fsExtra.outputFile(docPath, glb)
		// await io.write(docPath, meshDoc)
		array.push( {
			type,
			name,
			glbPath: docPath,
			bounding_box: get_bounding_box_by_doc(meshDoc),
			featureTableJson,
			batchTableJson
		})
	}
   
	const b3dmArray = array.filter(({type})=>type =="b3dm")

    

    let gltfs = b3dmArray.map(({glbPath})=>glbPath )
	const output = `./tmp/${filenamify("b3dmAll")}.glb`
	const  docMerge = await mergeGltfs(gltfs,{
		normal:true,
		output
	})
   
	const mergeB3dmArray = array.filter(({type})=>type =="i3dm")
	mergeB3dmArray.push(
		{
			type:"b3dm",
			name:"mergedB3dm",
			glbPath: output,
			bounding_box: get_bounding_box_by_doc(docMerge),
			batchTableJson:{
				batchId: Array.from(b3dmArray,({batchTableJson})=>batchTableJson.batchId).flat(),
				name: Array.from(b3dmArray,({batchTableJson})=>batchTableJson.batchId).flat(),
				maxPoint: [],
				minPoint: []	
			}
		}
	)

        //  await exec({
		// 	path:
		// 	[...gltfs,"./tmp/merge.exec.glb"]})
       const result =  await exec(["merge",...gltfs,"./tmp/merge.exec.glb"])
       console.log("merge result");

    // array is all i3dm and all b3dm
	// mergeB3dmArray is all i3dm and mergedB3dm
	return mergeB3dmArray;
    // console.log(promiseArray);
	// return allProgress(promiseArray,
	// 	(p) => {
	// 		console.log(`% i3dm Done = ${p.toFixed(2)}`);
	// 	});


}




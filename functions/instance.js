const { dedup, inspect, utils, prune } = require('@gltf-transform/functions');
const { InstancedMesh, MeshGPUInstancing } = require('@gltf-transform/extensions');
const { Quaternion, Euler } = require("three")
const { allProgress, get_bounding_box_by_doc } = require('../tools/utils');
const Piscina = require('piscina');
const path = require('path');
const { cpus } = require('os');
const ext = require('@gltf-transform/extensions');
var fsExtra = require('fs-extra');
const filenamify = require("filenamify");

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
function instance(doc) {
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
			const nodes = Array.from(meshInstances.get(mesh));
			// not instance mesh : all merge by material then  split to  b3dm
			if (nodes.length < 2) {
				const node = nodes[0];
				t = node.getWorldTranslation()
				r = node.getWorldRotation()
				s = node.getWorldScale()
				b3dms.push({
					type: "b3dm",
					mesh,
					TRANSFORMATIONS:{
						t,
						r,
						s
					}
				})
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
				let t, r, s;
				const node = nodes[i];
				t = node.getWorldTranslation()
				r = node.getWorldRotation()
				s = node.getWorldScale()

				modifiedNodes.push(node);
				{
					//i3dm
					featureTableJson.position.push(t)
					var quaternion = new Quaternion().fromArray(r);
					const euler = new Euler().setFromQuaternion(quaternion.normalize());
					featureTableJson.orientation.push([euler.x, euler.y, euler.z]);
					featureTableJson.scale.push(s)
				}
			}



			numBatches++;
			numInstances += nodes.length;


			{
				//i3dm 
				i3dms.push({
					type: "i3dm",
					mesh,
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
				//方向计算参考 https://github.com/PrincessGod/objTo3d-tiles/blob/181b186e2b3bddad0bd5d7857811f29b768f3406/lib/obj2I3dm.js#L160


			}
		}
	}

	if (numBatches > 0) {
		logger.info(
			`${NAME}: Created ${numBatches} batches, with ${numInstances} total instances.`
		);
	} else {
		logger.info(`${NAME}: No meshes with multiple parent nodes were found.`);
		batchExtension.dispose();
	}

	logger.debug(`${NAME}: Complete.`);
	const promiseArray = [...i3dms,...b3dms].map(async ({type, mesh,TRANSFORMATIONS,featureTableJson }, index) => {
		const newDoc = doc.clone();


		const curentMesh = newDoc.getRoot().listMeshes().filter(m => m.getName() == mesh.getName())[0];

		const oldScene = newDoc.getRoot().getDefaultScene();
		oldScene.dispose();
		const scene = newDoc.createScene();
		newDoc.getRoot().setDefaultScene(scene);
		const node = newDoc.createNode(mesh.getName());
		node.setMesh(curentMesh);
		if(TRANSFORMATIONS){
			node.setTranslation(TRANSFORMATIONS.t);
			node.setRotation(TRANSFORMATIONS.r);
			node.setScale(TRANSFORMATIONS.s);
		}
		scene.addChild(node);
		newDoc.getRoot().listNodes().forEach(element => {
			if (node != element) element.dispose();
		});


		// scene.traverse((n) => {
		//    console.log(node != n);
		//    if (node != n) scene.removeChild(n);
		// })

		const name = mesh.getName();
		//[Possibility to specify name for .bin files emmited from partition command? · Discussion #412 · donmccurdy/glTF-Transform](https://github.com/donmccurdy/glTF-Transform/discussions/412)
		newDoc.getRoot().listBuffers()[0].setURI(name + '.bin');

		console.log(index);
		console.log(name);

		const meshDoc =await newDoc.transform(prune())
		console.log(`i3dm doc Done ${index}`);
		const docPath = `./tmp/${filenamify(name.replace("/", ""))}.glb`
		const glb = await io.writeBinary(meshDoc)
		await fsExtra.outputFile(docPath, glb)
		// await io.write(docPath, meshDoc)

		return {
			type,
			name,
			glbPath: docPath,
			bounding_box: get_bounding_box_by_doc(meshDoc),
			featureTableJson
		};

		// const glb = await io.writeBinary(newDoc)
		// const newDocPath = `./tmp/${filenamify(name.replace("/",""))}.newDoc.glb`

		// // await fsExtra.outputFile(newDocPath, glb)
		// return piscina.run({
		// 	newDocPath,glb
		// }).then(async () => {
		// 	const glbPath = newDocPath.replace(".newDoc","")
		// 	console.log(`i3dm doc Done ${index}`);
		// 	console.log("glbPath",glbPath);
		// 	const doc = await io.read(glbPath)

		// 	return {
		// 		type: "i3dm",
		// 		name,
		// 		glbPath,
		// 		bounding_box: get_bounding_box_by_doc(doc)
		// 		, featureTableJson
		// 	};
		// });
	})
    console.log(promiseArray);
	return allProgress(promiseArray,
		(p) => {
			console.log(`% i3dm Done = ${p.toFixed(2)}`);
		});


}




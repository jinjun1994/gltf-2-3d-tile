const { Document, NodeIO } = require('@gltf-transform/core');
const { prune } = require('@gltf-transform/functions');

const ext = require('@gltf-transform/extensions');


(async () => {
    const io = new NodeIO().registerExtensions(ext.KHRONOS_EXTENSIONS);;
    const document = new Document();
    const paths = ["./models/merge/wire.glb", "./models/merge/xl-move.glb"]
    for (const path of paths) {
        document.merge(await io.read(path));
    }
    const root = document.getRoot();
    console.log(root);
    const mainScene = root.listScenes()[0];

    for (const scene of root.listScenes()) {
        if (scene === mainScene) continue;

        for (const child of scene.listChildren()) {
            // If conditions are met, append child to `mainScene`. 
            // Doing so will automatically detach it from the
            // previous scene.
        }

        scene.dispose();
    }

    await document.transform(prune());
    io.write(document, './models/merged.glb');

})()
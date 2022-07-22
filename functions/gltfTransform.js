const { dedup, inspect, utils, prune, weld } = require('@gltf-transform/functions');
const { program } = require("@gltf-transform/cli")


async function exec(args, options) {
    return  program
        .exec(args, options)
        .then(actionResult => {
            console.error(actionResult )
          })
        .catch((err)=> {
            console.error(err)
          })

}



module.exports = {
    exec,
}
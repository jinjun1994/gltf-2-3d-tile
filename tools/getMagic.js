'use strict';


module.exports = getMagic;

/**
 * @private
 */
function getMagic(tileBuffer, byteOffset = 0) {
    return tileBuffer.toString('utf8', byteOffset, byteOffset + 4);
}

'use strict';


module.exports = getBufferPadded;

/**
 * Pad the buffer to the next 8-byte boundary to ensure proper alignment for the section that follows.
 * Padding is not required by the 3D Tiles spec but is important when using Typed Arrays in JavaScript.
 *
 * @param {Buffer} buffer The buffer.
 * @param {Number} [byteOffset=0] The byte offset on which the buffer starts.
 * @returns {Buffer} The padded buffer.
 *
 * @private
 */
function getBufferPadded(buffer, byteOffset = 0) {
    if (!buffer) {
        return Buffer.alloc(0);
    }


    var boundary = 8;
    var byteLength = buffer.length;
    var remainder = (byteOffset + byteLength) % boundary;
    var padding = (remainder === 0) ? 0 : boundary - remainder;
    var emptyBuffer = Buffer.alloc(padding);
    return Buffer.concat([buffer, emptyBuffer]);
}

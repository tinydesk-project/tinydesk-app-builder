/* QR element checks: the format information against the QR standard's
 * table, the encoder against the original Melter HMI's Python encoder (when
 * the reference matrices are given), and the picture element apply() makes.
 *
 * tests/reference/qr_reference.json holds that encoder's matrices for six
 * texts (versions 1 to 5).
 */
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const Q = require('../qr.js');

// ISO/IEC 18004 table C.1, level L, masks 0..7.
const L = ['111011111000100', '111001011110011', '111110110101010', '111100010011101',
           '110011000101111', '110001100011000', '110110001000001', '110100101110110'];
L.forEach((bits, m) => assert.strictEqual(Q.formatBits(m).toString(2).padStart(15, '0'), bits, 'format bits, mask ' + m));

// Sizes: 21 + 4 per version.
assert.strictEqual(Q.matrix('A').length, 21);
assert.strictEqual(Q.matrix('http://192.168.4.1').length, 25);
assert.strictEqual(Q.matrix('x'.repeat(106)).length, 37);
assert.throws(() => Q.matrix('x'.repeat(107)), /too long/);

// Finder patterns in three corners, timing pattern alternating.
const m = Q.matrix('http://192.168.4.1'), n = m.length;
for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    assert.ok(m[cy][cx] && !m[cy - 2][cx] && m[cy - 3][cx], 'finder at ' + cx + ',' + cy);
}
for (let i = 8; i < n - 8; i++) assert.strictEqual(m[6][i], i % 2 === 0, 'timing ' + i);

// The reference encoder's matrices, module for module.
{
    const ref = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, 'reference', 'qr_reference.json'), 'utf8'));
    for (const [text, rows] of Object.entries(ref)) {
        const mine = Q.matrix(text).map(r => r.map(v => (v ? '1' : '0')).join(''));
        assert.deepStrictEqual(mine, rows, 'same as the reference: ' + text);
    }
    console.log('matches the reference encoder for', Object.keys(ref).length, 'texts');
}

// The element: a 20 x 10 cell box (200 x 200 px) holds 40 modules at 5 px.
const r = Q.apply({name: 'wifi_qr', x: 58, y: 4, w: 20, h: 10}, {text: 'http://192.168.4.1'});
assert.strictEqual(r.scale, 5);
assert.deepStrictEqual([r.file.w, r.file.h, r.element.asset.w, r.element.asset.h], [40, 40, 200, 200]);
assert.ok(r.file.name.startsWith('qr_') && r.file.name.endsWith('.ppm'));
assert.ok(Buffer.from(r.file.data, 'base64').length < 5000, 'a few kilobytes');
assert.throws(() => Q.apply({x: 0, y: 0, w: 20, h: 9}, {}), /square/);
console.log('qr: format bits, structure and element checks passed');

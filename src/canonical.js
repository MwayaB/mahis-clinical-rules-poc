import { createHash } from 'node:crypto';
export function canonicalStringify(value) {
  const seen = new Set();
  function encode(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (typeof v !== 'object' || seen.has(v)) throw new TypeError('Non-JSON or cyclic value');
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) throw new TypeError('Plain JSON objects required');
    seen.add(v);
    let result;
    if (Array.isArray(v)) {
      if (Object.keys(v).length !== v.length) throw new TypeError('Sparse or extended array');
      result = '[' + Array.from(v, encode).join(',') + ']';
    } else {
      if (Reflect.ownKeys(v).some(k => typeof k !== 'string')) throw new TypeError('Symbol key');
      result = '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + encode(v[k])).join(',') + '}';
    }
    seen.delete(v); return result;
  }
  return encode(value);
}
export function inputsHash(ctx) { return createHash('sha256').update(canonicalStringify(ctx)).digest('hex'); }

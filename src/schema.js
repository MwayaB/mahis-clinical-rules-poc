export const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export const nonempty = x => typeof x === 'string' && x.trim().length > 0;
export function fields(x, allowed, required, path, errors) {
  if (!object(x)) { errors.push(`${path}: expected object`); return false; }
  for (const k of Object.keys(x)) if (!allowed.includes(k)) errors.push(`${path}: unknown field ${k}`);
  for (const k of required) if (!Object.hasOwn(x,k)) errors.push(`${path}: missing ${k}`);
  return true;
}

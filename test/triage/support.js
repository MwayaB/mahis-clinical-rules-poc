import { readFileSync } from 'node:fs';
export const ir=JSON.parse(readFileSync(new URL('../../ir/triage_example.ir.json',import.meta.url)));
export const fixtures=JSON.parse(readFileSync(new URL('../../fixtures/triage_example.fixtures.json',import.meta.url)));
export const copy=x=>structuredClone(x);

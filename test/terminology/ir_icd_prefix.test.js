import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dose,clone } from '../helpers.js';
import { validateIR } from '../../src/ir.js';
import { defaultTerminology as seed } from '../../src/terminology.js';
test('IR known prefix validates; unknown prefix names node and code',()=>{assert.deepEqual(validateIR(dose,seed),[]);const ir=clone(dose);ir.nodes[0].applies_to.icd10='Z99';const errors=validateIR(ir,seed).join('\n');assert.match(errors,/al-dose-weight-band/);assert.match(errors,/Z99/);assert.match(errors,/unknown ICD-10 prefix/);});

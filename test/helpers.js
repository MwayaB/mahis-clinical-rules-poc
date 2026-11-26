import { readFileSync } from 'node:fs';
export const dose = JSON.parse(readFileSync(new URL('../ir/dose_band_example.ir.json',import.meta.url)));
export const predicate = JSON.parse(readFileSync(new URL('../ir/contraindication_example.ir.json',import.meta.url)));
export const ir = {...dose,nodes:[...dose.nodes,...predicate.nodes]};
export const clone = x=>structuredClone(x);
export const ctx = (changes={})=>Object.freeze({today:'2026-01-01',weight_kg:12,pregnant:false,proposed_atc:'P01BF01',proposed_tablets:2,...changes});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triageReviewEditor } from '../../../public/triage-review.js';
import { validateIR } from '../../../src/ir.js';
import { ir,copy } from './support.js';
class Element {
 constructor(tag,text='') {this.tag=tag;this.text=text;this.children=[];this.attrs={};}
 setAttribute(k,v) {this.attrs[k]=String(v);}
 append(...children) {this.children.push(...children);}
 get value() {if(this._value!==undefined) return this._value;if(this.tag==='select') return this.children.find(c=>'selected' in c.attrs)?.attrs.value??this.children[0]?.attrs.value??'';return this.attrs.value??'';}
 set value(v) {this._value=String(v);}
 get checked() {return this._checked??('checked' in this.attrs);}set checked(v){this._checked=v;}
 get textContent() {return this.text+this.children.map(c=>c.textContent??String(c)).join(' ');}
}
function dom(t) {const d=globalThis.document,n=globalThis.Node;globalThis.Node=Element;globalThis.document={createElement:tag=>new Element(tag),createTextNode:t=>new Element('#text',String(t))};t.after(()=>{globalThis.document=d;globalThis.Node=n;});}
const nodes=view=>[view,...view.children.flatMap(c=>c instanceof Element?nodes(c):[])];
function byLabel(view,label) {const all=nodes(view),target=all.find(n=>n.tag==='label'&&n.textContent===label);assert.ok(target,'Missing label '+label);return all.find(n=>n.id===target.attrs.for);}
test('triage review exposes named numeric and ordinal inputs and preserves all scoring fields',t=>{dom(t);const n=copy(ir.nodes[0]),editor=triageReviewEditor(n),text=editor.view.textContent;for(const label of ['Required scoring inputs','resp_rate','consciousness','Encounter input','Coverage minimum','Level value','Total score categories','Automatic rule overrides']) assert.ok(text.includes(label),label);assert.equal(byLabel(editor.view,'Encounter input').value,'resp_rate_per_min');const fields=['scope','parameters','score_bands','overrides','categories_order'];assert.deepEqual(editor.value(),Object.fromEntries(fields.map(k=>[k,n[k]])));assert.deepEqual(n,ir.nodes[0]);});
test('triage review serializes edited points and preserves ordinal strings and band endpoints',t=>{dom(t);const editor=triageReviewEditor(copy(ir.nodes[0]));byLabel(editor.view,'Points').value='4';const body=editor.value();assert.equal(body.parameters[0].bands[0].points,4);assert.equal(body.parameters[0].bands[0].max_inclusive,false);assert.deepEqual(body.parameters[1].levels,ir.nodes[0].parameters[1].levels);assert.deepEqual(validateIR({...copy(ir),nodes:[{...copy(ir.nodes[0]),...body}]}),[]);byLabel(editor.view,'Points').value='';assert.throws(()=>editor.value(),/Points is required/);});

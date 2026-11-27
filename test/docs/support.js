import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
export const root=new URL('../../',import.meta.url);
export const read=p=>readFileSync(new URL(p,root),'utf8');
export function files(dir){return readdirSync(new URL(dir,root),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
export const documents=()=>['README.md',...files('docs').filter(p=>p.endsWith('.md'))];

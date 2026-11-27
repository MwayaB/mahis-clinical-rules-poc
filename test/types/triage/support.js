import { readFileSync } from 'node:fs';
export const ir=JSON.parse(readFileSync(new URL('../../../ir/triage_example.ir.json',import.meta.url)));
export const fixtures=JSON.parse(readFileSync(new URL('../../../fixtures/triage_example.fixtures.json',import.meta.url)));
export const copy=x=>structuredClone(x);
export async function releasedTriageHTTP(s) {
 const source=await s.ok('/api/guidelines?filename=triage.pdf&document_id=PLACEHOLDER-TRIAGE',Buffer.from('%PDF-PLACEHOLDER triage test source'));
 await s.ok(`/api/guidelines/${source.sha256}/metadata`,{edition:'placeholder-2026'});
 const imported=await s.ok('/api/rules/import',{document_sha256:source.sha256,node:ir.nodes[0]});
 for(const reviewer of ['reviewer-a','reviewer-b']) await s.ok(`/api/ir/${imported.node.id}/approve`,{reviewer});
 await s.ok('/api/fixtures',{node_id:imported.node.id,entries:fixtures});
 const release=await s.ok('/api/releases',{document_sha256:source.sha256,version:'poc-demo-0.3.0'});
 return {source,release};
}

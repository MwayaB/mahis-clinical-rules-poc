export function invalidInput(definition,value) {
 const {kind,domain={}}=definition;
 if(kind==='numeric'&&(typeof value!=='number'||!Number.isFinite(value)||domain.integer&&!Number.isInteger(value))) return 'expected '+(domain.integer?'integer':'finite number');
 if(kind==='boolean'&&typeof value!=='boolean'||['string','ordinal'].includes(kind)&&typeof value!=='string') return 'expected '+kind;
 if(domain.values&&!domain.values.includes(value)) return 'outside enumeration';
 if(domain.min!==undefined&&(value<domain.min||domain.min_inclusive===false&&value===domain.min)||domain.max!==undefined&&(value>domain.max||domain.max_inclusive===false&&value===domain.max)) return 'outside declared domain';
 return null;
}

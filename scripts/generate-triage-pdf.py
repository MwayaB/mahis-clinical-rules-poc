"""Render only the authored placeholder triage chart; no clinical content is inferred."""
from pathlib import Path
import json,hashlib
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
ROOT=Path(__file__).resolve().parent.parent
ir_path=ROOT/'ir/triage_example.ir.json';ir=json.loads(ir_path.read_text());node=ir['nodes'][0]
path=ROOT/'samples/triage/placeholder.pdf'
c=canvas.Canvas(str(path),pagesize=(612,792),invariant=1);c.setTitle('Placeholder adult triage chart')
def text(value,y,size=11,bold=False):
 c.setFillColor(HexColor('#20364b'));c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(40,792-y,str(value))
text('PLACEHOLDER ADULT TRIAGE CHART',45,19,True)
text('Invented thresholds, points and category labels. NOT CLINICAL GUIDANCE.',70,10,True)
y=112
for p in node['parameters']:
 text(p['name'].replace('_',' ').title(),y,14,True);y+=24
 if p['kind']=='numeric':
  for b in p['bands']:
   interval=f"{'[' if b['min_inclusive'] else '('}{b['min']}, {b['max']}{']' if b['max_inclusive'] else ')'}"
   text(f"{p['input']} {interval}: {b['points']} points",y);y+=22
 else:
  for level in p['levels']:text(f"{level['value']}: {level['points']} points",y);y+=22
 y+=18
text('Total score and category',y,14,True);y+=26
for b in node['score_bands']:text(f"{b['min']} to {b['max']} inclusive: {b['category']}",y);y+=22
y+=18;text('Priority override',y,14,True);y+=26
for o in node['overrides']:text('If '+', '.join(f'{k} = {v}' for k,v in o['when'].items())+': '+o['category'],y);y+=22
text('Use the higher category. Assess clinical urgency independently.',y+12)
text('Placeholder chart for review and software testing only.',750,9)
c.save();ir['document']['checksum']='sha256:'+hashlib.sha256(path.read_bytes()).hexdigest();ir_path.write_text(json.dumps(ir,indent=2)+'\n')
print(ir['document']['checksum'])

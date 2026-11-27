"""Rebuild the placeholder PDF, exact mock digitisation and sample fixtures from source.json."""
import hashlib,json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor,white
from reportlab.lib.utils import simpleSplit
ROOT=Path(__file__).resolve().parent.parent
base=ROOT/'samples/dose-guide'
source=json.loads((base/'source.json').read_text())
triage_path=ROOT/'ir/triage_example.ir.json';triage_ir=json.loads(triage_path.read_text());triage=triage_ir['nodes'][0]
chart=[]
for parameter in triage['parameters']:
 chart.append((parameter['name'].replace('_',' ').title(),14,True))
 if parameter['kind']=='numeric':
  for band in parameter['bands']:
   interval=f"{'[' if band['min_inclusive'] else '('}{band['min']}, {band['max']}{']' if band['max_inclusive'] else ')'}"
   chart.append((f"{parameter['input']} {interval}: {band['points']} points",11,False))
 else:
  chart.extend((f"{level['value']}: {level['points']} points",11,False) for level in parameter['levels'])
chart.append(('Total score and category',14,True))
chart.extend((f"{band['min']} to {band['max']} inclusive: {band['category']}",11,False) for band in triage['score_bands'])
chart.append(('Priority override',14,True))
chart.extend(('If '+', '.join(f'{k} = {v}' for k,v in override['when'].items())+': '+override['category'],11,False) for override in triage['overrides'])
chart.append(('Use the higher category. Assess clinical urgency independently.',11,False))
triage_block={'page':2,'id':'b4','kind':'paragraph','bbox':[40,120,572,720],'text':'Adult triage scoring.\n'+'\n'.join(row[0] for row in chart)}
source['blocks']=[b for b in source['blocks'] if b['id']!='b4']+[triage_block]
(base/'source.json').write_text(json.dumps(source,indent=2)+'\n')
pdf=base/'placeholder.pdf'
c=canvas.Canvas(str(pdf),pagesize=(612,792),invariant=1)
c.setTitle(source['title'])
def line(text,x,y,size=11,bold=False,color='#20364b'):
 c.setFillColor(HexColor(color));c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,792-y,text)
def wrapped(text,x,y,width=520,size=11):
 for row in simpleSplit(text,'Helvetica',size,width):line(row,x,y,size);y+=16
 return y

def header(subtitle):
 c.setFillColor(HexColor('#f1f5f9'));c.rect(0,690,612,102,fill=1,stroke=0)
 line('PLACEHOLDER EDITION 2026',40,32,10,True)
 line(subtitle,40,62,22,True)
 line(source['disclaimer'],40,86,9,True,'#b42318')
def footer(page):
 line('Placeholder edition 2026 | Not for patient care',40,760,9)
 line(f'{page} / 2',540,760,9)
header('Placeholder treatment guideline')
for b in [b for b in source['blocks'] if b['page']==1]:
 x,top,right,bottom=b['bbox'];y=top
 line({'b1':'1. Malaria','b2':'2. Use in pregnancy','b3':'3. Pneumonia'}[b['id']],x,y,14,True);y+=23
 y=wrapped(b['text'],x,y,right-x,10)+10
 if b['kind']=='table':
  for i,row in enumerate(b['cells']):
   c.setFillColor(HexColor('#e2e8f0' if i==0 else '#f8fafc'));c.rect(x,792-y-23,right-x,23,fill=1,stroke=0)
   line(row[0],x+12,y+15,11,i==0);line(row[1],x+300,y+15,11,i==0);y+=24
footer(1);c.showPage();header('Adult triage scoring')
y=140
for value,size,bold in chart:
 if bold:y+=12
 line(value,40,y,size,bold);y+=23
footer(2);c.save()
sha=hashlib.sha256(pdf.read_bytes()).hexdigest()
bundle_path=base/'bundle.json';bundle=json.loads(bundle_path.read_text());old=bundle['document_sha256']
fixture={'digitiser':'mock-fixture','document_sha256':sha,'pages':[{'page':page,'blocks':[{k:v for k,v in b.items() if k!='page'} for b in source['blocks'] if b['page']==page]} for page in sorted({b['page'] for b in source['blocks']})]}
oldpath=ROOT/'fixtures/digitised'/f'{old}.json'
if oldpath.exists() and old!=sha:oldpath.unlink()
(ROOT/'fixtures/digitised'/f'{sha}.json').write_text(json.dumps(fixture,indent=2)+'\n')
bundle['document_sha256']=sha;bundle['atc_by_block']['b3']='P01BF01'
bundle.pop('supplemental_applicability_by_block',None);bundle.pop('supplemental_applicability_note',None)
bundle['source_note']='Drug dosing, pregnancy applicability and adult triage scoring are all stated explicitly in the combined PDF and matching mock blocks.'
bundle['triage_block_id']='b4';bundle['release_version']='poc-demo-0.4.0'
demo_path=ROOT/'samples/triage/demo.json';demo=json.loads(demo_path.read_text());demo['release_version']=bundle['release_version'];demo_path.write_text(json.dumps(demo,indent=2)+'\n')
triage_ir['document']={**triage_ir['document'],'id':bundle['document_id'],'edition':bundle['edition'],'checksum':'sha256:'+sha}
triage['source']={k:triage_block[k] for k in ['page','bbox','text']}
triage_path.write_text(json.dumps(triage_ir,indent=2)+'\n')
bundle['authored_rules_by_block']={'b4':json.loads(json.dumps(triage))}
(ROOT/'samples/triage/placeholder.pdf').write_bytes(pdf.read_bytes())
# Preserve existing clinical values; only fixture source identity and contexts change.
for fs in bundle['fixtures'].values():
 for f in fs:f['expect']=[s.replace(old,sha) if isinstance(s,str) else s for s in f['expect']]
ctx={'today':'2026-01-01','weight_kg':12,'pregnant':False,'proposed_atc':'P01BF01','proposed_tablets':3,'active_diagnoses':[{'icd10':bundle['demo_diagnoses']['pneumonia']['icd10'],'certainty':'confirmed','terminology_version':'seed-placeholder-2026'}]}
bundle['fixtures']['b3']=[{'name':'PLACEHOLDER pneumonia positive','ctx':ctx,'expect':[sha+'-b3']},{'name':'PLACEHOLDER pneumonia negative','ctx':{**ctx,'proposed_tablets':2},'expect':[]}]
triage_fixtures=json.loads((ROOT/'fixtures/triage_example.fixtures.json').read_text())
for f in triage_fixtures:
 for expected in f['expect']:expected['node_id']=sha+'-b4'
bundle['fixtures']['b4']=triage_fixtures
bundle_path.write_text(json.dumps(bundle,indent=2)+'\n')
(base/'digitisation.json').write_text(json.dumps(fixture,indent=2)+'\n')
(base/'sample-fixtures.json').write_text(json.dumps(bundle['fixtures'],indent=2)+'\n')
print(sha)

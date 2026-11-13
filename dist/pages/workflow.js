import {scenes} from './scene-options.js?v=9123dd77378a280e';
const $=id=>document.getElementById(id);
const occasion=$('occasion');occasion.replaceChildren();
const automatic=document.createElement('option');automatic.value='auto';automatic.textContent='상품에 맞게, 매번 새롭게';occasion.append(automatic);
for(const group of [...new Set(scenes.map(scene=>scene.group))]){const groupNode=document.createElement('optgroup');groupNode.label=group;for(const scene of scenes.filter(item=>item.group===group)){const option=document.createElement('option');option.value=scene.id;option.textContent=scene.label;groupNode.append(option)}occasion.append(groupNode)}
const direct=document.createElement('option');direct.value='직접';direct.textContent='직접 상황 적기';occasion.append(direct);occasion.dispatchEvent(new Event('change'));

let activeEditor='workbench';
function togglePanel(panel){
 if(panel==='workbench'||panel==='daily')activeEditor=panel;
 const daily=activeEditor==='daily';
 $('workbench').hidden=panel!=='workbench'&&panel!=='daily';
 $('rulesPanel').hidden=panel!=='rules';
 $('history').hidden=panel!=='history';
 $('draftArchive').hidden=panel!=='archive';
 for(const id of ['productEditor','phoneText','phonePhotos','productImportOpen'])$(id).hidden=daily;
 for(const id of ['dailyEditor','dailyPhoneText'])$(id).hidden=!daily;
 for(const button of document.querySelectorAll('[data-studio]')){
  if(button.dataset.studio===panel)button.setAttribute('aria-current','page');
  else button.removeAttribute('aria-current');
 }
}
document.querySelectorAll('[data-studio]').forEach(button=>button.addEventListener('click',()=>{
 if(button.dataset.studio==='history')$('saved').click();
 else{togglePanel(button.dataset.studio);window.scrollTo(0,0)}
}));
window.addEventListener('collection-reference-picked',()=>togglePanel(activeEditor));
$('rulesNav').addEventListener('click',()=>togglePanel('rules'));$('closeRules').addEventListener('click',()=>togglePanel('workbench'));
$('saved').addEventListener('click',()=>{togglePanel('history');window.scrollTo({top:0,behavior:'smooth'})});$('closeHistory').addEventListener('click',()=>togglePanel(activeEditor));
$('productImportOpen').addEventListener('click',()=>{$('productImportOpen').setAttribute('aria-current','step');$('generate').removeAttribute('aria-current');$('productImportDialog').showModal()});$('closeProductImport').addEventListener('click',()=>{$('productImportDialog').close();if(!$('url').value.trim())$('productImportOpen').removeAttribute('aria-current')});
function syncProductTile(){const name=$('name').value.trim();$('summaryName').textContent=name||'상품을 불러오면 여기에 보여요';$('summaryFacts').textContent=$('facts').value.split('\n').filter(Boolean).slice(0,2).join(' · ')||'상품에서 확인한 정보를 바탕으로 글을 작성합니다.';const link=$('summaryLink');if($('url').value){link.hidden=false;link.href=$('url').value}else link.hidden=true}
window.addEventListener('product-loaded',()=>{$('productImportDialog').close();syncProductTile();$('productImportOpen').removeAttribute('aria-current');$('generate').setAttribute('aria-current','step');$('writingTitle').scrollIntoView({behavior:'smooth',block:'start'})});
$('name').addEventListener('input',syncProductTile);$('facts').addEventListener('input',syncProductTile);$('images').addEventListener('input',syncProductTile);
window.addEventListener('content-ready',()=>{syncProductTile();const preview=$('phoneText');if(preview)preview.textContent=$('copyText')?.value||'초안이 준비됐어요.'});

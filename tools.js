/* Quick Digital Tools: computations run locally in the visitor's browser. */
(() => {
 const grid=document.getElementById("tools-page-grid"); if(!grid)return;
 const status=document.getElementById("tools-page-status"), disabled=document.getElementById("tools-disabled-message");
 const cards=new Map([...grid.querySelectorAll("[data-tool-id]")].map(card=>[card.dataset.toolId,card]));
 const format=value=>Number.isFinite(value)?value.toLocaleString(undefined,{maximumFractionDigits:8}):"—";
 const enabled=new Set();
 fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content",{method:"GET",headers:{"Accept":"application/json"},credentials:"omit"})
 .then(response=>{if(!response.ok)throw new Error("Tools configuration unavailable");return response.json();})
 .then(payload=>{
  const config=payload.quickTools;
  if(!config||config.enabled!==true||!Array.isArray(config.items)){grid.hidden=true;disabled.hidden=false;status.textContent="Tools are currently disabled.";return;}
  config.items.forEach(id=>{const card=cards.get(id);if(!card||enabled.has(id))return;enabled.add(id);card.hidden=false;grid.append(card);});
  if(!enabled.size){grid.hidden=true;disabled.hidden=false;status.textContent="No tools are currently published.";return;}
  status.textContent=enabled.size+" quick tool(s) available.";
  const hash=location.hash.slice(1);if(cards.has(hash)&&enabled.has(hash))cards.get(hash).scrollIntoView({behavior:"smooth",block:"start"});
 }).catch(()=>{grid.hidden=true;disabled.hidden=false;status.textContent="Could not load the tools catalogue.";});
 document.getElementById("calculator-form")?.addEventListener("submit",event=>{
  event.preventDefault();const a=Number(document.getElementById("calc-first").value),b=Number(document.getElementById("calc-second").value),op=document.getElementById("calc-operation").value;let result;
  if(op==="add")result=a+b;else if(op==="subtract")result=a-b;else if(op==="multiply")result=a*b;else result=b===0?NaN:a/b;
  document.getElementById("calc-result").textContent=Number.isFinite(result)?"Result: "+format(result):"Enter valid numbers; division by zero is not allowed.";
 });
 document.getElementById("percentage-form")?.addEventListener("submit",event=>{
  event.preventDefault();const p=Number(document.getElementById("percent-value").value),v=Number(document.getElementById("percent-total").value);
  document.getElementById("percentage-result").textContent="Result: "+format(p*v/100);
 });
 const textInput=document.getElementById("word-counter-input");
 textInput?.addEventListener("input",()=>{const value=textInput.value,words=value.trim()?value.trim().split(/\s+/).length:0;
  document.getElementById("word-count").textContent=words.toLocaleString();document.getElementById("character-count").textContent=value.length.toLocaleString();
  document.getElementById("reading-time").textContent=(words?Math.max(1,Math.ceil(words/200)):0)+" min";});
 const units={m:1,km:1000,cm:.01,mm:.001,ft:.3048,in:.0254};
 document.getElementById("unit-converter-form")?.addEventListener("submit",event=>{
  event.preventDefault();const value=Number(document.getElementById("unit-value").value),from=document.getElementById("unit-from").value,to=document.getElementById("unit-to").value;
  document.getElementById("unit-result").textContent="Result: "+format(value*units[from]/units[to])+" "+to;
 });
})();

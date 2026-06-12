function utf8ToBase64(value = "") {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function customRuntimeDocument(item) {
  const html = JSON.stringify(utf8ToBase64(item.html || ""));
  const css = JSON.stringify(utf8ToBase64(item.css || ""));
  const js = JSON.stringify(utf8ToBase64(item.js || ""));
  const id = JSON.stringify(item.id);
  return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:1px;background:transparent}body{overflow:hidden}</style></head><body><div id="host"></div><script>
const decode=value=>new TextDecoder().decode(Uint8Array.from(atob(value),character=>character.charCodeAt(0)));
const host=document.getElementById('host');const root=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=':host{display:block}*{box-sizing:border-box}'+decode(${css});root.append(style);const content=document.createElement('div');content.innerHTML=decode(${html});root.append(content);
try{new Function('root','host',decode(${js}))(root,host)}catch(error){const message=document.createElement('pre');message.textContent='Erreur JavaScript: '+error.message;message.style.cssText='padding:12px;color:#b42318;background:#fff1f0;white-space:pre-wrap';root.append(message)}
const notify=()=>parent.postMessage({type:'phanes-custom-height',id:${id},height:Math.ceil(document.documentElement.scrollHeight)},'*');new ResizeObserver(notify).observe(host);addEventListener('load',notify);addEventListener('click',()=>parent.postMessage({type:'phanes-custom-select',id:${id}},'*'),true);
</script></body></html>`;
}

export { customRuntimeDocument, utf8ToBase64 };

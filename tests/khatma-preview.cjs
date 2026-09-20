// Isolated local browser fixture. All Firebase requests are redirected to in-memory data.
const http=require('node:http'), fs=require('node:fs/promises'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const stores=new Map();
const students=['طالب تجريبي','طالب ثان','طالب ثالث'];
const boot=`<script>
window.SHATIBIYYA_JAM_LOCAL_DEV = false;
localStorage.setItem('shatibiyya-production-session',JSON.stringify({email:'fixture@example.test',emailOnly:true,expiresAt:Date.now()+3600000}));
localStorage.setItem('shatibiyya-login-test-session',JSON.stringify({email:'fixture@example.test',emailOnly:true,expiresAt:Date.now()+3600000}));
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,opts={})=>{const u=new URL(typeof input==='string'?input:input.url,location.href);if(u.origin!==location.origin){return nativeFetch('/__fixture__'+u.pathname,opts);}return nativeFetch(input,opts);};
</script>`;
const server=http.createServer(async(req,res)=>{
 try {
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/__fixture__')||u.pathname.startsWith('/api/khatma/')){
  const name=u.pathname.replace('/__fixture__','');let value;
  if(name.includes('loginEmails'))value={role:'student',studentName:students[0],groupId:'group1'};
  else if(name.startsWith('/config'))value={students,weeks:[{id:'w1',start:1,end:10,date:'2026-09-19'}],statuses:{},settings:{weekBoundaryDay:6}};
  else if(name.startsWith('/submissions'))value={};
  else if(/^\/(khatma|review|jam)\/(groups|catalogs)\//.test(name)||name.startsWith('/api/khatma/')){
   const item=stores.get(name)||{value:{},revision:0};
   if(req.method==='PUT'){
    let raw='';for await(const chunk of req)raw+=chunk;
    if(req.headers['if-match']!==`"${item.revision}"`){res.writeHead(412);res.end('{}');return;}
    item.value=JSON.parse(raw);item.revision++;stores.set(name,item);
   }
   value=item.value;res.setHeader('ETag',`"${item.revision}"`);
  }else {res.writeHead(404);res.end('{}');return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
 }
 let file=path.join(root,u.pathname==='/'?'prof-login-dev.html':u.pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 let content=await fs.readFile(file);
 if(file.endsWith('.html'))content=content.toString().replace('<head>','<head>'+boot);
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(content);
 }catch(e){res.writeHead(404);res.end('Not found');}
});
const port = Number(process.env.PREVIEW_PORT || 4190);
server.listen(port,'127.0.0.1',()=>console.log(`Isolated preview: http://127.0.0.1:${port}/student-login-dev.html and /prof-login-dev.html?devMode=data`));

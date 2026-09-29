/* DEV-only Firebase REST subscriptions, with a polling fallback and lifecycle cleanup. */
window.LiveData = {
  watch({urls,change,state=()=>{},prepare=async()=>{},interval=30000}) {
    let stopped=false,running=false,again=false,debounce,streams=new Map(),version=0;
    const report=()=>state(streams.size && [...streams.values()].every(item=>item.connected)?'live':'retry');
    function schedule(){clearTimeout(debounce);debounce=setTimeout(refresh,250);}
    async function refresh(){
      if(stopped||document.hidden)return;
      if(running){again=true;return;}
      running=true;const token=version;
      try{
        await prepare();if(stopped||token!==version)return;
        const wanted=new Set(urls().filter(Boolean));
        for(const [url,item] of streams)if(!wanted.has(url)){item.source.close();streams.delete(url);}
        if(window.EventSource)for(const url of wanted)if(!streams.has(url)){
          const source=new EventSource(url),item={source,connected:false};streams.set(url,item);
          for(const type of ['put','patch'])source.addEventListener(type,()=>{if(stopped||token!==version)return;item.connected=true;report();schedule();});
          source.onerror=()=>{item.connected=false;report();};
          for(const type of ['cancel','auth_revoked'])source.addEventListener(type,()=>{source.close();streams.delete(url);state('retry');});
        }
        await change();
      }catch{if(!stopped)state('retry');}
      finally{running=false;if(again&&!stopped){again=false;schedule();}}
    }
    function disconnect(){version++;for(const item of streams.values())item.source.close();streams.clear();clearTimeout(debounce);}
    function visibility(){if(document.hidden)disconnect();else refresh();}
    const focus=()=>refresh();
    const timer=setInterval(refresh,interval);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',focus);window.addEventListener('online',focus);
    refresh();
    return {refresh,stop(){stopped=true;disconnect();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',focus);window.removeEventListener('online',focus);}};
  }
};

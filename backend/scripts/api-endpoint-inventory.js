import app from "../app.js";

export function endpointInventory() {
  const endpoints=[];
  const prefix=layer=>{
    const source=layer.regexp.source;
    if(source.startsWith("^\\/?"))return "";
    return "/"+source.replace(/^\^\\\//,"").split("\\/?")[0].replaceAll("\\/","/");
  };
  function visit(stack,mount="") {
    for(const layer of stack) {
      if(layer.route) {
        const route=(mount+(layer.route.path==="/"?"":layer.route.path)).replace(/\/$/,"");
        if(!route.startsWith("/api/"))continue;
        for(const method of Object.keys(layer.route.methods))endpoints.push({method:method.toUpperCase(),path:route});
      } else if(layer.handle?.stack)visit(layer.handle.stack,mount+prefix(layer));
    }
  }
  visit(app._router.stack);
  return endpoints.sort((a,b)=>(a.path+a.method).localeCompare(b.path+b.method));
}

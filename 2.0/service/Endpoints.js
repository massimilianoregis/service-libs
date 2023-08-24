class Endpoints{
    list=[];
    constructor(method,path,action,endpoints){           
        try{     
        this.list=[path].flat().map(path=>{
            var endpoint=new Endpoint(method,path,action)
            endpoints.push(endpoint)
            return endpoint;
        })  
        }catch(e){console.warn('Endpoints',method,path)}
    }
    set output(value){
        this.list.forEach(end=>end.output=value)
    }
    set input(value){
        this.list.forEach(end=>end.input=value)
    }
}

class Endpoint{
    path;
    action;
    method;
    endpoint;
    output;
    constructor(method,path,action){
        this.method=method.toUpperCase();
        this.action=action;
        this.params=[]        

        
        this.params=([...path.matchAll(":(?<name>[a-zA-Z]*)")].map(item=>item.groups.name));                                 


        this.path=path+"";
        this.endpoint=path+"";            
        
        for(var i in this.params)    {
            this.path=this.path.replace(`:${this.params[i]}`,"(.*?)");                                    
            this.endpoint=this.endpoint.replace(`:${this.params[i]}`,`{${this.params[i]}}`);                                    
        }
    }
    compatible(event){
        return this.path.find(path =>event.path.match(path) && event.httpMethod==this.method);
    }
    addRest(obj){
        
    }
    async  execute(event){
        return new Promise((ok,ko)=>{
            var req = new Request(event);
            var res = {
                json:json=>{
                    ok(json);
                }
            }
            
            this.action(req,res)
        })
    }
    description(){
        return `${this.method.toUpperCase()} ${this.endpoint}`
    }
}
module.exports=Endpoints;
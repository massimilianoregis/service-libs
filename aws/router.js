const application = require("express/lib/application");
const { Rest } = require("../http/rest");

class Request{
    constructor(event){
        this.method= event.httpMethod;
        this.query = event.queryStringParameters;
        this.params = event.pathParameters;
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

class Router {
    endpoints=[]
    constructor(app){
        this.app=app;
        this.router=this;
    }
    set setConfig(fnc){this._setConfig=fnc; this.app.setConfig=fnc;}
    get setConfig(){return this._setConfig;}
    set services(value){this._services = value; this.app.services=value;}
    set call(value){this.app.call=value;}
    get services() {return this._services;}
    get call() {return this._services;}
    get(path,parser,action){          
        if(parser.name!="jsonParser")  {action=parser; parser=null;}
        if(this.app) 
            if(parser)  this.app.get(path,parser,action);
            else        this.app.get(path,action);
                
        return new Endpoints('get',path,action,this.endpoints)
    }
    put(path,parser,action){
        if(parser.name!="jsonParser") {action=parser; parser=null;}
        if(this.app) 
            if(parser) this.app.put(path,parser,action);
            else this.app.put(path,action);

        return new Endpoints('put',path,action,this.endpoints)    
    }
    post(path,parser,action){
        if(parser.name!="jsonParser")  {action=parser; parser=null;}
        if(this.app) 
            if(parser) this.app.post(path,parser,action);
            else this.app.post(path,action);
        return new Endpoints('post',path,action,this.endpoints)
    }
    delete(path,parser,action){
        if(parser.name!="jsonParser")  {action=parser; parser=null;}
        if(this.app) 
            if(parser)  this.app.delete(path,parser,action);
            else        this.app.delete(path,action);
        return new Endpoints('delete',path,action,this.endpoints)
    }
    all(path,parser,action){
        if(parser.name!="jsonParser")  {action=parser; parser=null;}
        if(this.app) 
            if(parser)  this.app.all(path,parser,action);
            else        this.app.all(path,action);
        return new Endpoints('all',path,action,this.endpoints)   
    }
    use(path,parser,action){        
        if(parser && parser.name!="jsonParser")  {action=parser; parser=null;}
        if(this.app) {
            if(action) 
                if(parser)  this.app.use(path,parser,action.app||action);
                else        this.app.use(path,action.app||action);
            else {
                this.app.use(path.app||path);                
                try{this.addRouter(path)}catch(e){}
            }
        }        
        if(typeof(path)=="string" )
            return new Endpoints('use',path,action,this.endpoints)                
    }
    addRest(object,path,fnc){    
        var app = this.app;
        Object.defineProperty(object, 'services', {
            get: function() { return app.services }
          });        
        new Rest(object,this,path,fnc);
    }
    addRouter(router){          
        for(var i in router.endpoints){
            var endpoint =router.endpoints[i];
            this.endpoints.push(endpoint)
        }
    }
    listen(port){
        this.app.listen(port);
    }
 
    async execute(event){               
        var endpoint = this.endpoints.find(item=>item.compatible(event))
        return await endpoint.execute(event);   
    }
    toJSON(){
        return this.endpoints.map(endpoint=>endpoint.description())        
    }
}

module.exports= Router;
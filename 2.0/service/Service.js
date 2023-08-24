var express = require("express");
const path = require('path');
const fs = require('fs');
const Rest  = require("./Rest");
const Config  = require("./Config");
const Endpoints  = require("./Endpoints");
const Info  = require("./Info");
const Call = require("./Call");



class Service{
    constructor(){
        this.app=express();    
        this.app.use(express.json())
        this.endpoints=[];
        new Info(this);
    }

    addDefaultConfig(fct){        
        var config = new Config(this);
            config.onConfig=(config)=>fct(config);
        
        return this;
    }
    addJsDoc(){
        console.log("addJsDoc")
        return this;
    }
    addHateoas(){
        this.app.use((req,res,next)=>{
            req.hateoas=(value)=>`http://${req.get('host')}${path.resolve(req.originalUrl,value)}`
            req.addLink=(obj,name,value)=>{
                if(!obj) return;
                obj.links=obj.links||{};
                obj.links[name]=req.hateoas(value)
            }
            next();
        })
        return this;
    }
    addRest(object,path,fnc){
        object.services= new Call();    
        var app = this.app;
        Object.defineProperty(object, 'services', {
            get: function() { return app.services }
          });        
        new Rest(object,this,path,fnc);
    }
    method(type,path,parser,action){
        if(parser.name!="jsonParser")  {action=parser; parser=null;}
        if(this.app) 
            if(parser)  this.app[type](path,parser,action);
            else        this.app[type](path,action);
        
        if(typeof(path)=="string")
            return new Endpoints(type,path,action,this.endpoints)
    }          
    get(path,parser,action){     
        return this.method("get",path,parser,action)             
    }
    put(path,parser,action){
        return this.method("put",path,parser,action)             
    }
    post(path,parser,action){
        return this.method("post",path,parser,action)             
    }
    delete(path,parser,action){
        return this.method("delete",path,parser,action)             
    }
    all(path,parser,action){
        return this.method("all",path,parser,action)             
    }
    use(path,parser,action){                
        if(parser && parser.name!="jsonParser")  {action=parser; parser=null;}
        if(this.app) {   
            var app = (action||parser||path);
            
            var mainApp=this;
            try{
            Object.defineProperty(app,"services",{
                get:()=>mainApp.services
            })}catch(e){console.log(e)}

            try{
            Object.defineProperty(app,"calls",{
                get:()=>mainApp.services
            })}catch(e){console.log(e)}

            if(action) 
                if(parser)  this.app.use(path,parser,action.app||action);
                else        this.app.use(path,action.app||action);
            else {
                this.app.use(path.app||path);                
                try{this.addRouter(path)}catch(e){}
            }
        }        
        
        if(typeof(path)=="string")
            return new Endpoints('use',path,action,this.endpoints)    
    }
    listen(port){
        console.log("start in port",port)
        this.app.listen(port);
    }
    toJSON(){
        return this.endpoints.map(endpoint=>endpoint.description())        
    }
}
module.exports=Service
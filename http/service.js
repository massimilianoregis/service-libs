var {Rest} = require("./rest");
var {Config} = require("./config");
var express = require("express");
const path = require('path');
const fs = require('fs');
const got = require('got');
const Router = require("../aws/router");


class Service{
    constructor(expressApp){
        this.app=expressApp;                
        this.status={rests:[]};     
        this.beat=this.beat.bind(this);
        this.onConfig=this.onConfig.bind(this);
    }    
    setAsSingleton(port){
        this.status.singleton=port
        this.status.config=true;      
        return this;
    }
    addRest(obj,path,queryParser){
        this.restPath = path
        this.obj=obj;        
        this.status.rests.push(
            {obj:obj,path:path,queryParser:queryParser}
        );

        return this;
    }
    addHateoas(){
        this.status.hateoas=true
        
        return this;
    }
    addJsDoc(dir){
        this.status.rests[this.status.rests.length-1].jsdoc=
            {dir:dir}
        return this;
    }
    addDefaultConfig(call){
        this.configCall=call;
        
        this.status.config=true;                
        return this;
    }
    addInfo(call){             
        this.status.info=call;  
        return this;
    }
    addSwagger(swagger){
        this.swagger=swagger;
        return this;
    }
    
    addHeartBeat(time){        
        this.status.heartbeat=time;
        this.status.info=true;
        return this;
    }
    addJsDoc(dir){
        this.status.openApi=dir;
        return this;
    }
    async beat(url,time,jwt){
        if(url&&time&&jwt)
            this.heartbeat={
                url:url,
                time:time,
                jwt:jwt
            }
        var info = Object.assign({
            pid:process.pid,
            endpoint:this.app.endpoint,
            heartbeat:{                
                interval:this.heartbeat.time
            }
        },this.app.info)
        
        try{
            await got.post(this.heartbeat.url,{json:info,headers:{auth:this.heartbeat.jwt}})
        }catch(e){console.log("*heartbeat error")}
    }
    onConfig(config,app){
        if(this.status.singleton)
            config.singleton=this.status.singleton
        
        config.heartbeat=config.heartbeat||this.status.heartbeat;
        if(config.heartbeat) {
            console.log("\r","heartbeat".green,config.endpoint.green)            
            this.beat(`${config.call.gateway}${config.call.heartbeat}`,
                config.heartbeat,
                config.call.jwt)
            
            
            setInterval(this.beat,this.heartbeat.time)    
        }
        this.configCall&&this.configCall(config,app)
    }
    createApp(){
        //in order to support Lambda
        const localStorage  = require('./localStorage');       
        var store= (localStorage.get()||{});
        if(store.app) return store.app;

        this.status.createApp=true;
        var {app,obj}=this;                
        
        if(!app)   
            //app=express();    
            app=new Router(express());    
            
        if(this.status.hateoas)
            app.use((req,res,next)=>{
                req.hateoas=(value)=>`http://${req.get('host')}${path.resolve(req.originalUrl,value)}`
                req.addLink=(obj,name,value)=>{
                    if(!obj) return;
                    obj.links=obj.links||{};
                    obj.links[name]=req.hateoas(value)
                }
                next();
            })
                                    
        app.use(express.json({
            reviver:(key,value)=>{                                        
                if(value&&value.charAt&&value.charAt(10)=="T"&&value.charAt(23)=="Z") {                        
                    const date = new Date(value);
                    if(date!="Invalid Date") return date;
                    return value;
                }            
                return value;
            },limit:'20mb'
        }))            
        app.use(express.raw({type:"*/*", limit: '10mb'}));
        
        app.config={};
        
        if(this.status.config)  {                
            this.configuration = new Config(
                this.status.rests.map(item=>item.obj),
                app,
                this.onConfig);            
        }        
         
        if(this.status.info)            
            app.info={
                test:"info",
                openApi:this.swagger
            }
            
            app.get("/info",(req,res,next)=>{                        
                var info=Object.assign({},app.info)
                const hateous=(name,url)=>{
                    info.links=info.links||{};
                    info.links[name]=`${req.protocol}://${req.host}${req.originalUrl}${url}`
                }
                if(this.status.info) Object.assign(info,this.status.info(hateous,info,req))
                info.endpoints=app.router.toJSON();
                res.json(info)
            })
        this.status.rests.forEach(rest=>{
            const {obj,path,queryParser,jsdoc}=rest;
            var restobj=new Rest(obj,app,path,queryParser);
            if(jsdoc)
                restobj.createJsDoc(jsdoc.dir);
            rest.rest= restobj
        })
        if(this.status.rest)    this.rest   = new Rest(obj,app,this.restPath);
        if(this.swagger)        app.swagger=this.swagger
        if(this.status.singleton) app.config.singleton=this.status.singleton;
        
        if(this.status.openApi)
            setTimeout(()=>{
                this._generateOpenApi(this.status.openApi,app)
            },1000)
        return app;
    }
    _generateOpenApi(dir,router){        
        var outputFile = path.resolve(dir,"rest.openApi");
        console.log("generateOpenApi:",outputFile)
		//if(fs.existsSync(outputFile)) return;
		
		const handlebars = require('handlebars');
        handlebars.registerHelper('braces', function(text) {
            var result = '{' + text + '}';
            return new handlebars.SafeString(result);
          });
        handlebars.registerHelper('method', function(b, opts) {
            if(this.method == b) // Or === depending on your needs
                return opts.fn(this);
        });
		var source = fs.readFileSync(path.resolve(__dirname,"rest/jsDocRouter.handlebar")).toString();	
		var template = handlebars.compile(source);

		var type = path.basename(dir); 
		var outputString = template(Object.assign(router,{
            type:type.substring(0,1).toLocaleUpperCase()+type.substring(1),
            root:"/"+path.relative(path.resolve(dir,"../../"),dir)
        }));
		fs.writeFileSync(outputFile,outputString)        
    }
    
    set swagger(value)  {
        this.addInfo();
        this._swagger=value;            
    }
    get swagger()       {return this._swagger;}

    get call()      {return this.configuration.call}
    set app(value)  {this._app=value;}
    get app(){      
        if(!this.status.createApp) this.app=this.createApp()
        return this._app;
    }
}
module.exports.Service=Service
var {Rest} = require("./rest");
var {Config} = require("./config");
var express = require("express");
const got = require('got');

class Service{
    constructor(app){        
        if(!app)   {
            app=express();                
            app.use(express.json())                        
        }
        app.config={};
        this.app=app;                
        this.status={};     
        this.beat=this.beat.bind(this);
        this.onConfig=this.onConfig.bind(this);
    }    
    setAsSingleton(port){       
        const {app} = this;      
        app.config.singleton=port
        return this;
    }
    addRest(obj,path){     
        const {app} = this;       
        new Rest(obj,app,path);        
        
        return this;
    }
    addDefaultConfig(call){
        const {app,obj,onConfig} = this;
        this.configCall=call;
        
        this.configuration = new Config(obj,app,onConfig);            
        return this;
    }
    addInfo(call){      
        const {app}=this;       
        app.info={
            test:"info"            
        }
        
        if(this.info) return this;

        this.info=true;
        app.get("/info",(req,res,next)=>{                        
            var info=Object.assign({},app.info)
            const hateous=(name,url)=>{
                info.links=info.links||{};
                info.links[name]=`${req.protocol}://${req.host}${req.originalUrl}${url}`
            }
            if(call) Object.assign(info,call(hateous,info,req))
            res.json(info)
        })
        return this;
    }
    addSwagger(swagger){
        const {app}=this; 
        app.info["openApi"]=swagger
        return this;
    }
    
    addHeartBeat(time){        
        this.status.heartbeat=time;
        this.status.info=true;
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
   

    
    set swagger(value)  {
        this.addInfo();
        this._swagger=value;            
    }
    get swagger()       {return this._swagger;}

    get call()      {return this.configuration.call}
   
}
module.exports.Service=Service
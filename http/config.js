const bodyParser = require("body-parser")
class Config{
    constructor(objs,app,call){
        this.objs=objs||[];                              
        this.app = app||require("express")();
        this.config={}
		this.addConfig(this.app);
        this.onConfig=call;
    }
    
    addConfig(app){
        app.setConfig=(config,gateway)=>{       
            this.onDefaultConfig(config);            
            if(this.onConfig) this.onConfig(config,gateway)
            app.config=config;
            return app;
        }
        app.get("/config",async(req,res,next)=>{
            res.json(app.config)
        })
        app.post("/config",async(req,res,next)=>{				
                try{					
                    app.config=req.body;                    
                    this.onDefaultConfig(app.config);
                    this.onConfig(app.config)
                    res.json(app.config);
                }catch(e){
                    next(e);
                }
            })
    }
    onDefaultConfig(config){
		this.config=config||{};		
        if(this.onCalls) this.onCalls(config);
		if(this.onServiceCall) this.onServiceCall(config)		
        if(this.onDB) this.onDB(config);                     
	}
    onCalls(config){
        //if(!config) return;
       // if(!config.calls) return;     

        var {call,calls} = config;
        call=call||{}
        var {Services} = require("./services");
        config={
            gateway:call.gateway,
            external:call.external,
            jwt: call.jwt,
            klaviyo:call.klaviyo,
            calls:calls
        }        
        var services = new Services(config)   
        this.call= services;
        
        this.objs.forEach(item=>item.services = services)
        this.app.services = services;
        this.app.call = services;
    }
    onServiceCall(config){
        /*
        if(!config.servicesCall) return;
        var {Services} = require("./services");
        var services = new Services(config.servicesCall)
		this.obj.services = services;
        this.app.services = services;
        */
    }
    onDB(config){
        if(!config) return;
        if(!config.db) return;
        var backup = config.backup||{};
        if(backup)        
            this.objs.forEach(obj=>obj.config(config.db,backup,backup.scheduleTime))
        else
            this.objs.forEach(obj=>obj.config(config.db))
    }
    
    
	onConfig(config){}    
}

module.exports.Config=Config
const bodyParser= require("body-parser");
const path = require("path")
const moment = require("moment-timezone")
const fs = require("fs");


class Config{
    axios=null;
	constructor(app){
		this.app=app;
        this.config={}        
        this.addSet();
        this.addGet()
	}
    onConfig(config){

    }
	addSet(){
        this.app.post("/config",(req,res,next)=>{
            var data = Object.assign(req.body,req.query);

            var axiosOpt ={}
            if(data.call?.jwt) axiosOpt={headers:{"auth":data.call?.jwt}};            
            this.app.services={
                axios: require("axios").create(axiosOpt)
            }
            this.app.calls=this.app.services;
            for(var name in data.calls){
                var call = data.calls[name];
                var {groups} = call.match("(?<verb>GET|POST|PUT|DELETE)?\\s?(?<url>.*)")
                var {verb,url} = groups;
                url=url.replace(/\${data}/g,"$data").replace(/\${/g,"${data.")
                eval(`
                this.app.services[name] = async (data)=>{                                           
                    ${(verb=='POST'||verb=='PUT')&&                    
                        `var {data} = await this.app.services.axios.${(verb||"GET").toLowerCase()}(\`${url}\`,data)`
                    }
                    ${(verb=='GET'||verb=='DELETE')&&                    
                        `var {data} = await this.app.services.axios.${(verb||"GET").toLowerCase()}(\`${url}\`)`
                    }
                    return data;                    
                }`)  
            }
            this.config=data;
            this.onConfig(data);                

            res.json(data);
        })
    }
    addGet(){
        this.app.get("/config",(req,res,next)=>{
            res.json(this.config);
        })
    }
}
module.exports=Config

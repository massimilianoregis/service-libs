const Cluster = require("./rpc")

class BroadCast{
    constructor(cluster,app){
        this.cluster=cluster;
        this.app=app;
    }
    
    get(endpoint,fnc){
        this.cluster.receive=(data)=>{
            var {req}=data;
            if(req.method=="GET")
                fnc(data.data,{json:()=>{}
        })}
        
        this.app.get(endpoint,(req,res,next)=>{            
    
        var data={
                method:req.method,
                query:req.query,
                body:req.body,
                params:req.params,
                originalUrl:req.originalUrl
            }                    
    
            
            fnc(req,res,next)
            this.cluster.sendMessage(data)
            return {req:req,res:res}        
        })
    }   
}

module.exports= BroadCast
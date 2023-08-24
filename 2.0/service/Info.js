
class Config{

    constructor(app){
        this.app=app;
        this.addGet();
    }
    addGet(){
        this.app.get("/info",(req,res,next)=>{              
            try{          
                var info={}
                const hateous=(name,url)=>{
                    info.links=info.links||{};
                    info.links[name]=`${req.protocol}://${req.host}${req.originalUrl}${url}`
                }
                //if(this.status.info) Object.assign(info,this.status.info(hateous,info,req))      
                res.json(this.app.toJSON())
            }catch(e){
                res.end(e)
            }
        })
    }
}
module.exports=Config;
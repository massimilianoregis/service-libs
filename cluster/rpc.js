
var Broadcast = require("./propagation")

class Cluster{
    constructor(name,app){
        this.name=name;
        this.app=app;
        
        process.on('message',  (data)=>{
          this.receive(data);
         });
         
    }

    get broadcast(){
        if(!this._broadcast) this._broadcast= new Broadcast(this,this.app);
        return this._broadcast;
    }
    
    async getWorkers(){
        var pm2 = require('pm2');
        if(this.workers) return this.workers;
        return new Promise(ok=>{
            this.workers = [];            
            pm2.connect( (err)=>{
                pm2.list( (err, data)=>{
                    for (var i in data) {    
                        if(data[i].name==this.name)
                            this.workers.push({
                                name:data[i].name,
                                pid:data[i].pid,
                                pm_id:data[i].pm_id
                                })
                    }
    
                    ok(this.workers);
                    pm2.disconnect();
                });
            });
    
        })
    }

    async sendMessage(msg){
        var pm2 = require('pm2');
        var workers=await this.getWorkers();
        return new Promise(ok=>{
            var result={}
            pm2.connect(()=>{
                for (var i in workers) {                    
                    if(process.pid!=workers[i].pid){   
                        result[workers[i].pm_id]="sent";   
                        result[process.pid]="current";                     
                        pm2.sendDataToProcessId(workers[i].pm_id,{
                            id:workers[i].pm_id,
                            data:msg,
                            topic:"test",
                            pid:workers[i].pid
                        });                                      
                    }
                }
                ok(result);
                pm2.disconnect();
            });
        })
    }

    receive(msg){console.log("rpc receive",msg)}
}

module.exports.Cluster=Cluster

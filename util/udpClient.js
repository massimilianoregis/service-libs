RegExp.prototype.toJSON = RegExp.prototype.toString;
var udp = require('dgram');
var client = udp.createSocket({type:'udp4',reuseAddr:true});
var {v4:uuid} = require("uuid");


//var requests ={}
class Client{
    constructor(url,port){
        this.url=url;
        this.port=port;
        
    }    
    enableReceiving(){
        client.on('message',function(msg){
            Call.receive(msg);
        })
        return this;    
    }
    async send(method,data){
        //console.log("**udp client",method,data)
        const {port,url} = this;        
        return await Call.callAndWait(url,port,method,data);
    }
}

class Call{
    static delete(uuid){
        delete this.list[uuid];        
    }
    static add(call){
        this.list=this.list||{};
        this.list[call.uuid]=call;        
    }
    static get(id){
        return this.list[id];
    }
    static receive(msg){
        msg = JSON.parse(msg)
        const {uuid,data,tokens,i,error}= msg
        
        try{this.get(uuid).received(data,tokens,i,error);}catch(e){}
    }
    static async callAndWait(url,port,method,data){
        var result = await new Call(url,port).callAndWaitResponse(method,data);
        return result;
    }

    constructor(url,port){
        this.uuid= uuid();    
        this.url=url;
        this.port=port;
        this.tokens=0;        
        
        Call.add(this);
    }    
    
    async callAndWaitResponse(method,data){
        return new Promise((ok,ko)=>{
            this.ok=ok;
            this.ko=ko;                
            this.call(method,data)
        })        
    }
    async call(method,data){
        const {uuid,url,port} = this;
        data = {uuid:uuid,method:method,data:data};
        client.send(JSON.stringify(data),port,url)
    }
    addToken(token,i,tokens){            
        if(!this.data) {
            this.data=new Array(tokens);    
            this.totalTokens=tokens;  
           // this.lostPackage=new LostPackages(this,tokens);
        }
        if(this.data[i])   return;
        
        //this.lostPackage.received(i);        
        this.tokens++;  
        this.data[i]=token; 
    }
    isReady(){
        return this.tokens==this.totalTokens;
    }
    received(data,tokens,i,error){                                
        clearTimeout(this.lostTime);
        this.addToken(data,i,tokens);        

        if(this.isReady()){        
            var response = JSON.parse(this.data.join("")); 
                 
            this.delete();
            if(error)   this.error(response)
            else        this.response(response)
            return;
            }      
        
        this.lostTime = setTimeout(()=>this.recall(),100)           
    }
    delete(){
        Call.delete(this.uuid);
        this.call("end",{id:this.uuid})
    }
    recall(){
        console.log("RECALL",this.tokens,this.totalTokens)    
        const {uuid,url,port,data} = this;
        
        for(var i=0;i<data.length;i++){
            if(!data[i]) {
                this.call("token",{i:i})
                console.log("*",i)                
            }
        }    
    }
    response(response){
        this.ok(response);
        Call.delete(this.uuid);
    }
    error(response){
        this.ko(response);
        Call.delete(this.uuid);
    }
    
    

}
module.exports= Client;
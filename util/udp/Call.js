var udp = require('dgram');
const { send } = require('process');

var {v4:uuid} = require("uuid");
var socket = udp.createSocket('udp4');   

class Call{    
    static delete(uuid){
        delete this.calls[uuid]
    }
    static send(url,port,data,uuid){
        new Call(url,port,uuid).send(data);
    }
    static setSocket(soc){
        socket=soc
    }
    static resend(token,uuid){
        console.log("resendToken",token)
        Call.get(uuid).sendToken(token);
    }
    static get(uuid){
        return this.calls[uuid]
    }

    constructor(url,port,id){
        this.uuid=id||uuid();
        this.socket=socket;        
        socket.setSendBufferSize(800000);
        //var size = parseInt((socket.getSendBufferSize()/3)-1000)
        this.splitRegex = eval(`/(.{1,10000})/g`)     
        console.log(this.splitRegex,url,port)
        this.url=url;
        this.port=port;     
        Call.calls[this.uuid]=this;
    }

    async sendToken(i){        
        const {uuid,tokens,error,port,address}=this;
        var token = this.tokens[i]
        var result = {  
            uuid:uuid,
            data:token,
            i:parseInt(i),
            tokens:tokens.length,
            error:error
        };
        const data = JSON.stringify(result)   

        return new Promise((ok,ko)=>{
            this.socket.send(data,port,address,(err)=>{
                if(err) return console.log(err)
                ok();
            });   
        })        
    }
    
    async send(data){
        this.tokens = JSON.stringify(data).match(this.splitRegex);       
        for(var i in this.tokens)             
           await this.sendToken(i);         
    }
}

Call.calls={};
module.exports=Call
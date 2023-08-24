const path = require("path");
const DB = require("../../../services/2021-08/dbase/service");
const UpdClient = require("../util/udpClient");
const updclient = new UpdClient("localhost",2222)
updclient.enableReceiving();
class Client{
    constructor(config){
        var ext = path.extname(config.filename);
        this.name= path.basename(config.filename,ext)     
    }

    loadDatabase(callback){callback(this.name);}
    unloadDatabase(){}
    ensureIndex(config,callback=()=>{}){
        updclient.send("index",{db:this.name,index:config})         
            .then(()=>callback(null))
            .catch(err=>callback(err||"generic error"));
    }

    count(query,callback){  
        updclient.send("count",{db:this.name,q:query})         
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
        
    insert(data,callback){
        updclient.send("insert",{db:this.name,data:data}) 
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
    update(query,update,opt,callback){        
        updclient.send("update",{db:this.name,q:query,update:update,opt:opt}) 
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
    remove(query,opt,callback){    
        updclient.send("delete",{db:this.name,q:query,opt:opt})
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));    
    }
    findOne(query,callback){
        updclient.send("findOne",{db:this.name,q:query})
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
    find(query,callback,skip,limit,sort){
        if(!callback) return new Cursor(this.name,query);
        updclient.send("find",{db:this.name,q:query,skip:skip,limit:limit,sort:sort})        
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
}

class Cursor{
    constructor(name,query){
        this.db=name;
        this.query=query;
    }
    skip(value){
        this.skip=value;
        return this;
    }
    limit(value){
        this.limit=value;
        return this;
    }
    sort(obj){
        this.sort=obj;
        return this;
    }
    exec(callback){
        const {db,query,skip,limit,sort}= this;
        updclient.send("find",{db:db,q:query,skip:skip,limit:limit,sort:sort})
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));        
    }
}
module.exports=Client
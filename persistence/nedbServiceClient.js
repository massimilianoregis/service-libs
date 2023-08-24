const path = require("path")
const services = require("../util/services");
services.jwt=""
services.gateway="http://localhost:3000/2021-08/dbase";
class Client{
    constructor(config){
        var ext = path.extname(config.filename);
        this.name= path.basename(config.filename,ext)     
    }

    loadDatabase(callback){callback();}
    unloadDatabase(){}
    ensureIndex(config,callback=()=>{}){
        services.post(`/${this.name}/index`,{index:config})         
            .then(()=>callback(null))
            .catch(err=>callback(err||"generic error"));
    }

    count(query,callback){   
        services.post(`/${this.name}/count`,{q:query})
            .then(doc=>callback(null,doc.count))
            .catch(err=>callback(err||"generic error"));
    }
        
    insert(data,callback){
        services.post(`/${this.name}`,data)
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
    update(query,update,opt,callback){        
        services.put(`/${this.name}`,{q:query,update:update,opt:opt})
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
    remove(query,opt,callback){            
        services.post(`/${this.name}/delete`,{q:query,opt:opt})
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));    
    }
    findOne(query,callback){
        services.post(`/${this.name}/findOne`,{q:query||{}})
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err||"generic error"));
    }
    find(query,callback,skip,limit,sort){
        if(!callback) return new Cursor(this.name,query);
        services.post(`/${this.name}/find`,{q:query,skip:skip,limit:limit,sort:sort})
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
        services.post(`/${db}/find`,
                {q:query,skip:skip,limit:limit,sort:sort})
            .then(doc=>callback(null,doc))
            .catch(err=>callback(err));        
    }
}
module.exports=Client
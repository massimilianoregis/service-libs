var ID, SECRET;
var BUCKET_NAME="basepaws-account";

const fs = require('fs');
const AWS = require('aws-sdk');
var path =require("path");
const stream = require('stream');
var crypto = require('crypto')

var fetch = require('requestify');

class S3{
    static config(key,secret,name,root){        
        return S3.instance(key,secret,name,root);        
    }
    static instance(key,secret,name,root){

        if(!S3._instance) S3._instance={} 
        var ht = key?crypto.createHash('md5').update(key+secret+name+root).digest("hex"):"default";
    
        if(!S3._instance[ht]) 
            if(ht=="default")   S3._instance[ht]= new S3();   
            else                S3._instance[ht]= new S3(key,secret,name,root);   
        return S3._instance[ht];
    }
    constructor(key,secret,name,root){
        this.key=key;
        this.secret=secret;
        this.zone="us-west-1"
        this.name=name;
        this.root=root||"";
        this.s3= new AWS.S3({
            accessKeyId: key,
            secretAccessKey: secret
            });        
    }
    getUrl(name){
        if(this.root)
            return `https://${this.name}.s3.amazonaws.com/${this.root}/${name}`
        else
            return `https://${this.name}.s3.amazonaws.com/${name}`
    }
    async saveFromUrl(url,name){        
        var response = await fetch.get(url)        
        await this.saveFromStream(response.body,name);
    }
    async saveFromStream(readStream,name){
          
            var response = this.getWriteStream(name)
            
            var writeStream = response.stream;
                readStream.on('error', (e) => {writestream.destroy();});                  
                writeStream.on('close', () => {readStream.destroy();});
                writeStream.on('error', (e) => {readStream.destroy();});
            readStream.pipe(writeStream);
          
            await response.promise;        
    }
    async saveFile(dir,name){    
        if(!name.startsWith(this.root) && this.root) name= this.root+"/"+name;                
        const fileContent = fs.readFileSync(dir);

        var params = {Bucket: this.name, Key:name , Body: fileContent};
        
        var result = await (this.s3.upload(params).promise())
        
        return result;   
        }
    async loadFiles(prefix){
        if(!prefix.startsWith(this.root) && this.root) prefix= this.root+"/"+prefix;  
        var params = {Bucket: this.name, Prefix:prefix};
        var data = await this.s3.listObjects(params).promise()
        return data.Contents
    }
    async loadLastModifiedFile(prefix){
        
        var list = await this.loadFiles(prefix)
        if(list.length==0) return null;
        var file =  list.reduce((result,item)=>new Date(item.LastModified)<new Date(result.item)?result.item:item)        

        return file;
    }

    async get(name){
        if(!name.startsWith(this.root) && this.root) name= this.root+"/"+name;
        try{
            var params = {Bucket: this.name, Key: name};     
            var obj = await this.s3.getObject(params).promise()
            return obj;
            }
        catch(e){
            return null;    

        }
        
    }
    parse(name){
        var path = name.match(/(?<Bucket>.*?)\:\/(?<Key>.*)/i)
        if(path) return path.groups;
        else    return {Bucket:this.name,Key:name};
    }
    async swap(from,to){
        var swap = `_swap/${to}`
        await this.move(to,swap);
        await this.move(from,to)
        await this.move(swap,from)
        await this.delete(`_swap`)
    }
    async move(from,to){
        this.copyv2(from,to);
        await this.delete(from)
    }
    async copyv2(from,to){        
        var from = this.parse(from);
        var to = this.parse(to);
        
        await this.s3.copyObject({
            Bucket:to.Bucket,
            Key: to.Key,
            CopySource:`${from.Bucket}/${from.Key}`
        }).promise()
    }

    async exists(name){        
        try{
            var data = this.parse(name)
            var list = await this.s3.getObject(data).promise()
            return true;
            }
        catch(e){            
            return false    
        }
        
    }
    async delete(name){    
        var params = this.parse(name)     
        await this.s3.deleteObject(params).promise()
        }
    async list(name,token,pageSize){
        token=token?token.replace(" ","+"):null;
        if(!name.startsWith(this.root) && this.root) name= this.root+"/"+name;
        try{
            var params = {
                Bucket: this.name, 
                Prefix: name,
                MaxKeys:pageSize||1000,
                ContinuationToken:token          
            };     
            
            var list = await this.s3.listObjectsV2(params).promise()
            var token=list.NextContinuationToken;
            var keyCount=list.KeyCount;
            list= list.Contents.map(item=>({
                name:item.Key.substring(name.length+1),
                changed: new Date(item.LastModified)                
            }))
            list.next=token
            list.count=keyCount;
            
            return list;
            }
        catch(e){
            return false    

        }
        
    }

    getReadStream(name){            
      var match =  name.match(/s3:\/\/(.*?)\/(.*)/);
      
      if(match)
        return this.s3.getObject({Bucket: match[1], Key: match[2]}).createReadStream();

      if(!name.startsWith(this.root) && this.root) name= this.root+"/"+name;      
      
      var params = {Bucket: this.name, Key: name};            
      return this.s3.getObject(params).createReadStream()        
    }
    getWriteStream(name,bucket) {
      if(this.root)        
        name = path.join(this.root,name)
      
      var pass = new stream.PassThrough();
      var params = {Bucket: bucket||this.name, Key: name, Body: pass};

      var promise = this.s3.upload(params).promise()
 
      pass._on=pass.on;
      pass.on=function (name,fnc){
        if(name!="end") return pass._on(name,fnc);        
        promise.then(fnc)
      }
      return {stream:pass,promise:promise};
    }

    copy(from,toBucket,toKey){
        if(from&&toBucket&&!toKey) return this.copyv2(from,toBucket);
        var match = from.match("s3:\/\/(.*?)\/(.*)")
        if(match) from = `https://s3.amazonaws.com/${match[1]}/${match[2]}`
        return this.s3.copyObject({
            Bucket:toBucket,
            Key: toKey,
            CopySource:from
        }).promise()
    }
    async copyFromS3(){
        
        return await (this.s3.copyObject({
            Bucket:"basepaws-account",
            CopySource:"https://s3.amazonaws.com/bpv2/images/pets/30876/nkYaMhPqqUa32lSUaBHpzFiSHt2GuSkQajAE5VGe.jpeg",
            Key:"prova.jpeg"
        }).promise());
    }
    

}

module.exports=S3

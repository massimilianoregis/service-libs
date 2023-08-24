const {Document} = require("./persistence");
const {NedbAdapter} = require("./nedbAdapter")
const Nedb=NedbAdapter;
const path = require("path")

class DataSet{
    constructor(name){
        this.name=name;        
    }
    setDB(db){
        this.db=db;
    }
    newPersistenceInfo(){
        return new PersistenceInfo(this.db)
    }
}

class PersistenceInfo{    
    get db(){
        if(this._db) return this._db;
        this._db= Nedb.instance({ filename: path.resolve(process.cwd(),this.name), autoload: true });	
        this._db.ensureIndex({ fieldName: 'id', unique: true });     
        return this._db;
    }
    constructor(name){    
        this.name=(name||"").toLowerCase();                    
        this.isNew = true;
    }
    
}

var capitalize=(value)=>
        value.substring(0,1).toUpperCase()+
        value.substring(1).toLowerCase()

class DataSetDocument extends Document{
    static newDataSet(name,properties){
        this.dataSet=this.dataSet||{};
        this.dataSet[name]=new DataSet(name)       
        this.addGetterAutoLoader(properties,name)
        return this.dataSet[name];
    }
    static addGetterAutoLoader(properties,dataSetName){
        for(var i in properties)            {
            const name = properties[i];
            var descriptor = Object.getOwnPropertyDescriptor(this.prototype,name)||{}
            
            if(!descriptor.get)
                descriptor.get=function (){                            
                       // this.loadDataSet(dataSetName);
                        return this["_"+name]
                    };
            if(!descriptor.set)
                descriptor.set=function (value){                                                        
                        this["_"+name]=value
                    }   
            Object.defineProperty(this.prototype,name,descriptor)        
        }
    }

    _persistence={};
    newPersistenceInfo(name){
        const dataSet = this.constructor.dataSet[name];
        return dataSet
            ?dataSet.newPersistenceInfo()
            :new PersistenceInfo(name);        
    }
    getPersistenceInfo(name){
        this._persistence[name]= 
            this._persistence[name]    
            ||this.newPersistenceInfo(name)            

        return this._persistence[name];
    }    
    async loadDataSet(name){       
        if(this.isNew)  return;
        this.stop++		
		try{
            var info = this.getPersistenceInfo(name);	

            var loader =this[`loadDataSet${capitalize(name)}`];   
            if(loader)
                await loader.call(this,info)
            else{
                var data = await info.db.findOne({id:this.id})||{};
                try{ this[`fromJSONDB${capitalize(name)}`].call(this,data); } catch(e){}                
            }

            //this[name]=data
            //Object.assign(this,data)
        }catch(e){
            console.error(e)
        }finally{
			this.stop--			
		}
    }
    async saveDataSet(name,user){      
        var saver =this[`saveDataSet${capitalize(name)}`];   
        if(saver) return await saver.call(this,info);

        var info = this.getPersistenceInfo(name);        
		var data;
        var toJSONMethod = this[`toJSONDB${capitalize(name)}`]
		if(toJSONMethod) 	data= toJSONMethod.call(this);		
        else                data= this.name;
        if(!data) return;
        await this.waiting();

		try	{
			info.isNew=false;            
			info.creation_time=new Date();
			info.created_by=user?user.email||user.name:null;
            data.id= this.id;
			data.creation_time=data.creation_time||info.creation_time;
			data.created_by=data.created_by||info.created_by;            
			return await info.db.insert(data)
		}catch(e){            
            info.updated_time=new Date();
            info.updated_by= user?user.email||user.name:null;
            data.updated_time=info.updated_time;
            data.updated_by=info.updated_by;
            await info.db.update({id:this.id},{$set:data})		
        }
    }

    async save(user){       
        for(var i in this.constructor.dataSet)
            await this.saveDataSet(i,user)        
        await super.save(user)
    }
}

module.exports.Document = DataSetDocument
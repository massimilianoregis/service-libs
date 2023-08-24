var {NedbAdapter:Db} = require("./nedbAdapter")
const path = require("path")
const Observe = require("../object/Observe")
var {v4:uuid} = require("uuid");
var {Services} = require("../http/services");
var User = require("../user")
var capitalize =(data)=>{
	if(!data) return "";
	if(data.length<2) return data;
	return data.charAt(0).toUpperCase() + data.slice(1);
}
class Document{
	static set services(value){this._service=value}
	static get services(){return this._service;}
	static set db(db){this._db=db;}
	static get db(){
		if(!this._db)
			this.setDB("db")
		return this._db;
	}
	static get dbName(){
		return this.name.toLowerCase()+".nedb";
	}
	static get DBRoot() {
		return process.cwd()
	}
	static config(dir,s3,backupTime){
		
		this.setDB(dir,s3,backupTime);	
	}
	static setDB(dir,s3,backupTime){
		if(typeof(dir)!="string") {this.db=dir; return;}
		var dir =path.resolve(this.DBRoot,dir)
		var db = Db.instance({ filename: path.resolve(dir,this.dbName), autoload: true },s3,backupTime);			
		this.configDB&&this.configDB(db);

		this.db = db
	}
	
	constructor(data,action){		
		data=data||{}
		this._loaded={};
		this.waitingList=[];		
		this.stop=0;

		this.action=action;	
		const isNew = !data.id		
		data.id=data.id||uuid()
		Object.assign(this,data)
		if(isNew) this.isNew=true;				
	}

	schema(schema){

	}
	static async newObject(data,action){
		var obj=new (this)(data,action);			
		await obj.load();
		await obj.waiting();	

		
			obj = Observe.createProxy(obj);		
			new Observe(obj);
		obj.action=null;
		return obj;
	}
	isChanged(){return this._observers[0].isChanged()}
	changes(){return this._observers[0].changes()}

	static async delete(id){
		await this.db.remove({id:id});
	}
	static async deleteMulti(find){
		await this.db.remove(find,{multi:true});
	}
	static async update(select,update,options){
		return await this.db.update(select,update,options);	
	}

	static async get(search){		
		var data = await this.db.findOne(search)
		if(!data) return null;		
		var value= await this.newObject(data,"load")
		
		return value;
	}
	
	static async count(search){
		return await this.db.count(search);
	}

	static async find(search,page=0,pageSize=100,sort){		
		var opt={}
		if(pageSize!=null)
			opt={limit:pageSize,skip:pageSize*page}		
		if(sort!=null)
			opt["sort"]=sort;

		const list = await this.db.find(search,opt);		
		var values =await Promise.all(list.map(item=>this.newObject(item,"load")))

		return values;
	}
	static async new(data,user){		
		var obj = await this.newObject(data,"new");				
		await obj.save(user);
		
		return obj;
	}
	get db(){
		return this.constructor.db;
	}

	get id(){return this._uuid;}
	set id(value)	{
		if(!value) return;
		this._uuid=value;		
	}
	get stop()		{return this._stop}
	set stop(value)	{
		this._stop=value;
		if(value==0) this.go();	
	}

	async waiting(){		
		if(this.stop==0) return;
		return new Promise(ok=>{
			this.waitingList.push(ok);
		})		
	}
	async go(){
		this.waitingList.concat([]).forEach(ok=>ok("some waiting"))
		this.waitingList=[];
	}
	async load(){}
	async get(url){
		this.stop++		
		try{	return await this.constructor.services.get(url);}
		finally{
			this.stop--			
		}
	}
	async delete(){
		await this.db.remove({id:this.id});
	}
	toDB(){
					
	}
	async beforeSave(){};
	async update(data){		
		Object.assign(this,data);		
		await this.save();
	}
	async save(user){		
		await this.beforeSave();
		await this.waiting();
		var data;
		if(this.toJSONDB) 	data= this.toJSONDB();
		else 				data= this.toJSON("db");	

		user = user||User.get()
		if(this.isNew)			{
			this.isNew=false;			
			this.creation_time=new Date();
			this.created_by=user?user.email||user.name:null;
			data.id=this.id;
			data.creation_time=this.creation_time;
			data.created_by=this.created_by;
			return await this.db.insert(data)
		}
		this.updated_time=new Date();
		this.updated_by= user?user.email||user.name:null;		
		data.updated_time=this.updated_time;
		data.updated_by=this.updated_by;
		await this.db.update({id:this.id},{$set:data})		
	}
	async to(name,type){				
		type=(type||"JSON").toUpperCase()
		
		const toJSON= this[`to${type}${capitalize(name)}`]		
		if(!toJSON) return await this.toJSON();
		var json={}
		try{json = await toJSON.call(this);}catch(e){}
		if(await this.waiting()) 
			try{json = await toJSON.call(this);}catch(e){}
		return json;
	}
	toJSON(){
		var json = Object.assign({id:this.id},this);		
		
		delete json.waitingList;
		delete json.stop;
		delete json._stop;
		delete json.action;
		delete json._uuid;
		delete json._id;
		delete json.isNew;
		delete json._observers;
		delete json._persistence;
		delete json._loaded;
		
		Object.keys(json).filter(key => key[0] === "_").forEach(key => {
			json[key.substring(1)]=json[key];
            delete json[key];			
        });
		
		return json;
	}
}
Document.services=new Services();
module.exports = {Document:Document}
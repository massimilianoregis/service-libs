//const Datastore = require('./nedb-multi')(Number(process.env.NEDB_MULTI_PORT||3333));
const Datastore = require('./nedb')
//const Datastore = require("./nedbServiceClient");
//const Datastore = require("./nedbUdpClient");
const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');
var S3;
var schedule = require('node-schedule');
RegExp.prototype.toJSON = RegExp.prototype.toString;

class NeDB{
	static backupConfig(defaultList,scheduleTime){		
		if(scheduleTime){
			console.log(`backup:\ttime: ${scheduleTime}`.green)			
			schedule.scheduleJob(scheduleTime, ()=>{
					NeDB.backup(defaultList)
				})
		}
		console.log(`\tlist: ${defaultList}`.green)
		NeDB._backupList=defaultList
	}
	static copyConfig(defaultList){
		console.log(`copy:\tlist: ${defaultList}`.green)
		NeDB._copyList=defaultList
	}
	static backupTime(schedule){
		NeDB._instance.forEach(item=>{
			item.setBackupTime(schedule);
		})
	}
	static getInstances(){
		return NeDB._instance;
	}
	static async copyMostRecentDB(list){
		list=list||NeDB._copyList;
		var result = []
		for (var i in NeDB._instance){
			var nedb = NeDB._instance[i];
			if(!list || list.indexOf(nedb.id)>=0){
				var data={}
				try{data = await nedb.copyFromS3();}
				catch(e){data.error=e}
				data.db=nedb.name;
				result.push(data);
			}
		}
		setTimeout(()=>{process.exit(0)},10000)
		return result;
	}
	static async backup(list){		
		list=list||NeDB._backupList;
		var result = []
		for (var i in NeDB._instance){
			var nedb = NeDB._instance[i];
			if(!list || list.indexOf(nedb.id)>=0){
				var data={}
				try{data.s3 = await nedb.copyToS3();}
				catch(e){data.error=e}
				data.db=nedb.name;
				result.push(data);
			}
		}
		return result;
	}
	static instance(config,s3,backupTime){
		NeDB._instance=NeDB._instance||[];

		var name =config.filename;				
		var instance = NeDB._instance.find(item=>item.name==name)
		if(instance) return instance;
		return new NeDB(config,s3,backupTime)
	}
	
	async loading(){
		if(this.loaded) return;
		return new Promise((ok,ko)=>{
			this.waitLoading=this.waitLoading||[]
			this.waitLoading.push(ok);
		})		
	}
	async onLoad(){		
		console.log("loaded",this.name); 
		this.loaded=true;		
		(this.waitLoading||[]).forEach(ok=>ok());
		this.waitLoading=null;		
	}


	constructor(config,s3,backupTime){	
		if(!NeDB._instance) NeDB._instance=[];
		NeDB._instance.push(this);				
		if(typeof(config)=="string") 
			config={filename:config}		
		this.db = new Datastore(config);			
		this.name=config.filename;		
		this.file=config.filename;	
		this.db.loadDatabase(()=>this.onLoad());
		this.id = path.basename(this.name,".nedb")
		
		console.log(`dbase:\t${this.id}`.green,this.file)

		try{
			const S3 = require("../aws/s3");
			if(s3)	this.s3 = S3.instance(s3.key,s3.secret,s3.bucketName,s3.root);
			if(backupTime) this.setBackupTime(backupTime);
			}
		catch(e){}
		}


	ensureIndex(config){
		this.db.ensureIndex(config);
	}
	async unloadDatabase(){
		console.log(this.db)
		this.db.unloadDatabase()
	}

	async update(select,update,options){		
		return new Promise((ok,ko)=>{
			this.db.update(select,update,options||{},(err,doc)=>{
				if(err) return ko(err);
				ok(doc);
			})
		})
	}
	async count(select){
		select=select||{};
		return new Promise((ok,ko)=>{
			this.db.count(select||{},(err,doc)=>{
				if(err) return ko(err);
				ok(doc);
			})
		})	
	}
	async find(select,opt){		
		return new Promise((ok,ko)=>{
			var query = this.db.find(select);			
			if(opt && opt.skip) query=query.skip(parseInt(opt.skip))
			if(opt && opt.limit) query=query.limit(parseInt(opt.limit))
			if(opt && opt.sort) query=query.sort(opt.sort)
			query.exec((err,doc)=>{
				if(err) return ko(err);
				ok(doc);
			})
		})	
	} 
	async findOne(select){		
		return new Promise((ok,ko)=>{
			this.db.findOne(select,(err,doc)=>{
				if(err) return ko(err);
				ok(doc);
			})
		})	
	}
	async insert(data){				
		return new Promise((ok,ko)=>{
			this.db.insert(data,(err,doc)=>{
				if(err) return ko(err);
				ok(doc);
			})
		})		
	}
	async remove(data,opt){
		return new Promise((ok,ko)=>{
			this.db.remove(data,opt||{},(err,doc)=>{
				if(err) return ko(err);
				ok(doc);
			})
		})		
	}

	
	setBackupTime(time){
		if(this.s3)	schedule.scheduleJob(time, ()=>{this.copyToS3();});
	}
	setBackupOnS3(s3){
		this.s3=s3;
	}
	async backup(){
		await this.copyToS3()
	}
	async copyToS3(){
		console.log("backup: "+this.file)
		if(!this.s3) throw "no S3 defined 'setBackupOnS3'";
		var date = moment(new Date()).format("yyyy-MM-DD")
		var name = path.basename(this.file);
		console.log(this.file+"-->"+`${name}/${date}.nedb`)
		return await this.s3.saveFile(this.file,`${name}/${date}.nedb`);		
	}
	async copyFromS3(){

		return new Promise(async (ok,ko)=>{
			if(!this.s3) return ko(this.name+": no S3! defined 'setBackupOnS3'");
			var name = path.basename(this.file);			
			var file = await this.s3.loadLastModifiedFile(name);
			if(file==null)	return ko(this.name+": no found on S3!");
			var readStream = this.s3.getReadStream(file.Key)
			var writeStream = fs.createWriteStream(this.file)

				readStream.on('error', (e) => {writeStream.destroy(); ko(e)});					
				writeStream.on('close', () => {readStream.destroy(); ok(file);});
				writeStream.on('error', (e) => {readStream.destroy(); ko(e);});			
			readStream.pipe(writeStream);
		})
	}
	
}

/*
this object is used to create atomatically an archive db
*/
class NeDBArchive extends NeDB{
	static instance(config,s3,backupTime){
		NeDB._instance=NeDB._instance||[];

		var name =config.filename;				
		var instance = NeDB._instance.find(item=>item.name==name)
		if(instance) return instance;
		
		return new NeDBArchive(config,s3,backupTime)
	}
	set enableArchiveSearch(value){this._enableArchiveSearch=value;}
	get enableArchiveSearch(){return this._enableArchiveSearch;}

	//--wrapper methods around archive in order to enable research
	async count(select){
		if(!this.enableArchiveSearch) return await super.count(select)

		var result = await Promise.all([
			this.getArchive().count(select),
			super.count(select)
		])
		
		return result[0]+result[1];
	}
	async find(select,opt){		
		if(!this.enableArchiveSearch) return await super.find(select,opt)

		var result = await Promise.all([
			this.getArchive().find(select,opt),
			super.find(select,opt)
		])
		return result[0].concat(result[1]);		
	} 
	async findOne(select){
		if(!this.enableArchiveSearch) return await super.findOne(select)

		var result = await Promise.all([
			this.getArchive().findOne(select),
			super.findOne(select)
		])
		return result[0]?result[0]:result[1];
	}
	//--/wrapper methods around archive in order to enable research

	//load archive NeDB instance
	getArchive(){
		if(this._archivedb) return this._archivedb;
		var ext = path.extname(this.file)
		var name =path.basename(this.file,ext);
		
		var archiveName=path.resolve(this.file,"..",`archive_${name}${ext}`);
		this._archivedb = NeDB.instance(archiveName)
		return this._archivedb;
	}
	//create a new archive name
	getNewArchive(){
		var ext = path.extname(this.file)
		var name =path.basename(this.file,ext);

		//archive name is <dbpath>/archive/<dbName><creation date>.nedb
		var archiveName=path.resolve(this.file,"../archive",`${name}${moment().format("YYYY-MM-DD")}${ext}`);
		this._archivedb = NeDB.instance(archiveName)
		return this._archivedb;
	}
	async archive(){		
		var list = await this.archiveData();
		var archiveDb= this.getArchive();		
		for(var i in list){
			var item = list[i];
			try{await archiveDb.insert(item);}catch(e){}
			await this.remove({_id:item._id})
		}
		await archiveDb.unloadDatabase();
		return list;
	}
	//extract data to archive
	async archiveData(){	
		if(!this.algoritm){
			var {FindOldDataAfterLimit} = require("./archive")	 		
			this.algoritm=new FindOldDataAfterLimit(this,50000);
			}
		return await this.algoritm.find();	
	}
}
module.exports.NedbAdapter=NeDBArchive;
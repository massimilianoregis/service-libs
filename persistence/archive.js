class DataToArchive {
	async find(){}
}

class FindOldDataAfterLimit extends DataToArchive{
	constructor(db,limit){
		super();
		this.db=db;
		this.limit=limit;
	}
	async find(){
		var size = await this.db.count();
		if(size<this.limit) return [];
		return await this.db.find({},{limit:size-this.limit,sort:{creation_time:1}})
	}
}

class FindOldDataTime extends DataToArchive{
	constructor(db,limit){
		super();
		this.db=db;
		this.limit=limit;
	}
	async find(){
		var size = await this.db.count();
		return await this.db.find({},{limit:size-limit,sort:{creation_time:1}})
	}
}

module.exports.DataToArchive=DataToArchive;
module.exports.FindOldDataTime=FindOldDataTime;
module.exports.FindOldDataAfterLimit=FindOldDataAfterLimit;
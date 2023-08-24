const bodyParser= require("body-parser");
const path = require("path")
const moment = require("moment-timezone");
const objectDiff = require("../persistence/objectDiff")



const fs = require("fs");
const { JsonStringifier,JsonParser } = require("jackson-js");
const Call = require("./Call");


class Rest{
	static unmarshal(text,cls){			
		return new JsonParser({mainCreator:() => [cls]}).transform(text)
	}
	static marshal(obj,cls){		
		const jsonStringifier = new JsonStringifier();
		return jsonStringifier.transform(obj,{        
			withViews:()=>[cls||obj.constructor.name]
		})
	}
	constructor(obj, app,path,queryParser){
		this.obj=obj;
		if(path=="/") path="";
		this.path=path||"";				
		this.app = app||require("express")();	

		this.app.use(bodyParser.json());	
		this.all(queryParser);
		this.create();			
		this.meta();
		this.app.use(`${this.path}`,async(req,res,next)=>{		
			req.call=new Call();
			var relations={}
			var content= req.query.content

			try{ relations = await this.obj[`load${req.method.toUpperCase()}`](); }catch(e){}
			if(content){
				var capitalize =content.charAt(0).toUpperCase() + content.slice(1);	
				try{ relations = await this.obj[`load${capitalize}`](); }catch(e){}
			}									
			req.relations=relations;	
			next();
		})
		this.app.use(`${this.path}/:id`,async(req,res,next)=>{
		var uniques = this.uniques();			
			for(var i in uniques){
				try{
				req.obj= await this.obj.findOne({
					where:{[uniques[i]]:req.params.id},
					relations:req.relations
				})
				if(req.obj!=null) return next();
				}catch(e){console.log("query error...")}
			}
			return res.status(500).send({error:'resource not found'});
		})	
		this.update();	
		this.delete();		
		this.get();					
		this.error();
		
	}
	uniques(){
		var list =  this.obj.dataSource.entityMetadatas
			.find(item=>item.targetName==this.obj.name) //exctract the right Metadatas
			.uniques.map(un=>un.columns.map(cl=>cl.propertyPath))   //transform unique metadata to string
			.map(list=>list[0])										//consider just one property as unique

		list.unshift("id");
		return list;
	}
	meta(){
		this.app.get(`${this.path}/meta`,(req,res,next)=>{			
			res.json({uniques:this.uniques()})
		})
	}
	createJsDoc(dir){		
		var outputFile = path.resolve(dir,"restJsDoc.js");
		if(fs.existsSync(outputFile)) return;
		
		const handlebars = require('handlebars');
		var source = fs.readFileSync(path.resolve(__dirname,"rest/jsDoc.handlebar")).toString();	
		var template = handlebars.compile(source);

		var spl = dir.split("/")
		var endpoint = spl.slice(spl.length-2).join("/");
		var data ={
			endpoint:`/${endpoint}${this.path&&"/"}${this.path}`,
			subject:this.obj.name
		}
		var outputString = template(data);
		fs.writeFileSync(outputFile,outputString)
	}	
	
	all(queryParser){		
		this.app.post(`${this.path}/ids`,async(req,res,next)=>{				
			const {ids} = req.body;
			const query={$or:ids}
			
			var list = await this.obj.find(query)
			
			res.json(list)
		})

		var endpoint=this.app.get(`${this.path}/`,async(req,res,next)=>{		
			console.log("rest 2.0 GET")
			var {count,page,pageSize,sort,content,output,format='json',filename} = req.query;
			if(filename)
				try{
					format =path.extname(filename).substring(1)||format;
					filename=path.basename(filename,path.extname(filename));
				}catch(e){}

			const start = new Date();
			page = parseInt(page||0);
			pageSize = parseInt(pageSize||20);
			sort = sort?{[sort]:-1}:null

			var query = Object.assign({},req.query);
				delete query.page;			
				delete query.pageSize;
				delete query.count;		
				delete query.sort;
				delete query.content;		
				delete query.filename;		

			var parser= (queryToParse)=>{
				//if I have id or ids nothing other params is needed
				var query={};			
				if(queryToParse.id){
					const ids = queryToParse.id.split(",")
					if(ids.length==1) return query.id=ids[1];
					return query={$or:ids.map(id=>({id:id}))}					
				}		
				
				for(var key in queryToParse){	
					if(key=="format"||key=="output") break;			
					var values = queryToParse[key];
					
					if(Array.isArray(values) && values.length==1) 
						values={$in:value[0]}
					if(!Array.isArray(values))
						values=[values]
					
					for(var i in values){
						var value = values[i];

						//day
						const daysago= value&&value.match&&value.match('^<(?<days>\\d+)d$')
						if(daysago) {
							var date=moment().subtract(daysago.groups.days,'day');
							value={$gte:date}
						}
						if(value&&value.match&&value.match(".?../../....")) {
							var init = value.substring(0,1);
							var date=moment(value.substring(1),"MM/DD/YYYY").toDate();
							if(init==">") value={$gte:date}
							if(init=="<") value={$lte:date}							
						}
						if(value&&value.match&&value.match("../../....")) value={$gte:moment(value).startOf("day").toDate(),$lte:moment(value).endOf("day").toDate()}
						//month 
						if(value&&value.match&&value.match("....-.."));						
						if(value=="!null")
							value={$exists:true,$ne:null}
						if(value=="!exist")
							value={$exists:false}
						if(value=="exist")
							value={$exists:true}
						if(value=="null")
							value=null					
						if(value&&value.startsWith&&value.startsWith(">"))
							value={$gte:value.substring(1)}
						if(value&&value.startsWith&&value.startsWith("<"))
							value={$lte:value.substring(1)}
						if(value&&value.startsWith&&value.startsWith("!"))
							value={$exists:true,$ne:value.substring(1)}
					
						if(query[key]) 	query[key]=Object.assign(query[key],value);
						else			query[key]=value;		
					}			
				}
				return query;
			}
			
			query = queryParser?queryParser(query,parser):parser(query);				
													
			//var list = await this.obj.find(query,page,pageSize,sort)		
			console.log("Rest 2.0 all",query)
            var list= []
			try{
				list=await this.obj.find({
					where:query,
					skip:pageSize*page,
					take:pageSize,
					relations:req.relations
				});
			}catch(e){console.log(e);}
			
			

			if(count) return res.json({
				time:(new Date()-start),
				count:await this.obj.count(query),
				list:list,
				items_per_page: pageSize,
				next:next})						
			
			list=Rest.marshal(list,this.obj);

			if(format=="json" && !output){				
				res.json(list)
			}
			
			if(format=="csv"){
				res.set('Content-Type', 'text/csv');					
				var result;
				if(list.length>0&& typeof(list.item)=='string')
					result = list.join('\r\n')
				else					
					result = new Parser({ delimiter: '\t',quote:'' }).parse(list)				
			}
			if(format==="html") {
				res.set('Content-Type', 'text/html'); 
				return res.send(list.join('\n\r'));
			}
			if(filename){
				res.attachment((filename||'file')+"."+format);			
				return res.send(result);
			}
		})

		endpoint.output=`array<${this.obj.name}>`
	}
	get(){
		var endpoint=this.app.get(`${this.path}/:id`,async(req,res,next)=>{				
				var {content,output,format}= req.query;					
				format=format||"json";				
				var response = Rest.marshal(req.obj,this.obj);
				if(format=="json" && !output){
					return res.json(response)
				}
				if(format==="html") {
					res.set('Content-Type', 'text/html'); 
					return res.send(response);
				}
				if(format==="json") return res.json(response);
				return res.json(response)
			})
		
				
		endpoint.output=this.obj.name
	}
	create(){
		var endpoint =this.app.post(`${this.path}`,async(req,res,next)=>{		
			try{				
				if(!req.body.id) delete req.body.id;
				console.log("POST: ",req.body)
				var obj = Rest.unmarshal(req.body, this.obj)						
				console.log("POST: ",obj)
				res.json(Rest.marshal(await obj.save()));
			}catch(e){				
				console.log("create",e)
				next(e);
			}
			})
		endpoint.input={body:this.obj.name}
		endpoint.output=this.obj.name
	}
	update(){		
		var endpoint =this.app.put(`${this.path}/:id`,async(req,res,next)=>{				
				try{																				
					var obj = Rest.unmarshal(req.body, this.obj)		
					//objectDiff(req.obj,obj)
					if(obj.set)	req.obj.set(obj)
					else		Object.assign(req.obj,obj);
					
					await req.obj.save();

					res.json(Rest.marshal(req.obj));
				}catch(e){				
					console.log(e)	
					next(e);
				}
			})
		endpoint.input={body:this.obj.name,path:{'id':'string'}}
		endpoint.output=this.obj.name
	}
	delete(){		
		var endpoint =this.app.delete(`${this.path}/:id`,async(req,res,next)=>{				
				try{
					await req.obj.delete();
					res.json(req.obj);
				}catch(e){
					next(e);
				}
			})
		endpoint.input={path:{'id':'string'}}
		endpoint.output=this.obj.name
	}
	error(){		
		this.app.use(async(err,req,res,next)=>{				
				res.status(500).send({error:err});
			})
	}
	populate(){
		this.app.get(`${this.path}/populate`,async(req,res,next)=>{
				var obj = await this.obj.new(this.obj.populate(),req.user)
				res.json(obj);
			})
	}
}

module.exports=Rest
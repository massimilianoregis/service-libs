const bodyParser= require("body-parser");
const path = require("path")
const moment = require("moment-timezone")

const fs = require("fs");
const { transforms: { unwind, flatten },Parser } = require('json2csv');

require("../util/promiseLimit")

class Rest{
	constructor(obj, app,path,queryParser){
		this.obj=obj;
		if(path=="/") path="";
		this.path=path||"";				
		this.app = app||require("express")();	

		this.all(queryParser);
		this.create();
		this.app.use(`${this.path}/:id`,async(req,res,next)=>{
			req.obj= await this.obj.get({id:req.params.id})
			next()
		})	
		//this.populate();		
		this.get();			
		this.update();	
		this.delete();	
		this.error();
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
				delete query._start;
				delete query._end;	
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
						if(value=="true")
							value=true;
						if(value=="false")
							value=false;
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
													
			var list = await this.obj.find(query,page,pageSize,sort)		
			
			if(content){
				var capitalize =content.charAt(0).toUpperCase() + content.slice(1);	
				const promiseList=list.map(item=>
					()=>{										
						return item[`load${capitalize}`]()
					}
				);
				await Promise.allConcurrent(50)(promiseList)			
			}

			if(count) return res.json({
				time:(new Date()-start),
				count:await this.obj.count(query),
				list:list,
				items_per_page: pageSize,
				next:next})
				
			if(format=="json" && !output)
				return res.json(list)
			
			list=await Promise.all(list.map(item=>item.to(output,format)))			
			
			if(format=="csv"){
				var result;
				if(list.length>0&& typeof(list.item)=='string')
					result = list.join('\r\n')
				else					
					result = new Parser({ delimiter: '\t',quote:'' }).parse(list)

				res.header('Content-Type', 'text/csv');
				//if (res.getHeader('Content-Length')) 
				//res.setHeader('Content-Length', String(result.length));						
			}
			if(format==="html") {
				res.set('Content-Type', 'text/html'); 
				return res.send(list.join('\n\r'));
			}
			if(filename)
				res.attachment((filename||'file')+"."+format);
			return res.send(result);
		})

		endpoint.output=`array<${this.obj.name}>`
	}
	get(){
		var endpoint=this.app.get(`${this.path}/:id`,async(req,res,next)=>{				
				var {content,output,format}= req.query;					
				format=format||"json";
				if(!req.obj) return res.status(500).send({error:'resource not found'});

				var capitalize =(data)=>data.charAt(0).toUpperCase() + data.slice(1);
				if(content)					
					await req.obj[`load${capitalize(content)}`]()			
				
				var response = await req.obj.to(output,format);
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
		var endpoint =this.app.post(`${this.path}/`,async(req,res,next)=>{				
			try{
				res.json(await this.obj.new(req.body,req.user));
			}catch(e){
				console.log("create",e)
				next(e);
			}
			})
		endpoint.input={body:this.obj.name}
		endpoint.output=this.obj.name
	}
	update(){		
		var endpoint =this.app.put(`${this.path}/:id`,bodyParser.json(),async(req,res,next)=>{				
				try{
					await req.obj.update(req.body);
					res.json(req.obj);
				}catch(e){					
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

module.exports={Rest:Rest}
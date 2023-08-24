var requestify= require("requestify");	
const path=require("path");
const querystring = require('querystring');
var ws = require("./websocket")
var slackToken = "";
var klaviyo
class Services{
	static defaultConfig(config){
		Services.config=config;
	}
	constructor(config){
		this.config(config);
	}
	setKlaviyo(code){
		klaviyo=new (require('klaviyo-node'))(code);	
	}
	config(config={}){		
		const defConfig = Services.config||{}

		this.gateway=config.gateway||defConfig.gateway;
		this.externalGateway=config.external
		this.jwt=config.jwt||defConfig.jwt;	
		this.calls=config.calls;
		if(config.klaviyo)	
			klaviyo=new (require('klaviyo-node'))(config.klaviyo||defConfig.klaviyo);
	}	
	get calls()		{return this._calls;}
	set calls(value){
		this._calls=value;
		for(var i in this.calls){
			var call = this.calls[i];		
				
			var {method,url,jwt,body}=call;				
			if(typeof(call)=="string") url=call;
			if(!jwt) jwt=this.jwt;
			if(url.startsWith("GET")){
				url=url.substring(4);
				method="GET";
			}
			if(url.startsWith("POST")){
				url=url.substring(5);
				method="POST";
			}
			if(url.startsWith("PUT")){
				url=url.substring(4);
				method="PUT";
			}
			if(url.startsWith("DELETE")){
				url=url.substring(7);
				method="DELETE";			
			}
			if(url.startsWith("/")) url=this.gateway+url;
			if(method=="POST"&&body==null) body="${body}"
			if(method=="PUT"&&body==null) body="${body}"
			body=body||{}		
				
			eval(`this[i]=async(data)=>{				
				var url = this.${i}Url(data)
				var body = data;

				if(this.${i}Body)
					body=this.${i}Body(data);																
				
				return await this.${method.toLowerCase()}(url,body,'${jwt}')				
			}`)
			if(body){
				if(typeof(body)==="string"){
					if(body=="${body}")
						eval(`this['${i}Body']=(data)=>{							
							return data;
						}`)
					else{
						var prop=body.match(/\$\{(.*)\}/)[1]					
						eval(`this['${i}Body']=(data)=>{							
							return data[prop];
						}`)
					}
				}
				else{
					//${xx}-->${data.xx}
					var bodyTranslated=JSON.stringify(body).replace(/\${data}/g,"$data").replace(/\${/g,"${data.")					
					eval(`this['${i}Body']=(data)=>{																													
						const body= JSON.parse(\`${bodyTranslated}\`);						
						if(body.data=="$data")body.data=data;						
						return body;
					}`)
				}
			}
			eval(`this['${i}Url']=(data)=>{
				return \`${url.replace(/\${/g,"${data.")}\`;
			}`)
		}
	}
	
	async callOptimizer(type,url,params,jwt){	
		const matching=url.match(/(?<call>.*?)\/(?<id>.{8}-.{4}-.{4}-.{4}-.{12})/)
		
		if(matching) {
			const {call,id} = matching.groups;
			this.waiting=this.waiting||{}; 
			this.waiting[call]=this.waiting[call]||{ids:[]}			

			var data = this.waiting[call];
			try{clearTimeout(data.timer)}catch(e){}
			return new Promise((ok,ko)=>{									
				data.ids.push({id:id,ok:ok,ko:ko});
				data.timer = setTimeout(async ()=>{																		
					var result;
					if(data.ids.length==1)
						result = [await this.get(call+"/"+data.ids[0].id)];									
					else
						result = await this.post(call+"/ids",{ids:data.ids.map(item=>item.id)})										


					data.ids.forEach(itemID=>{
						const obj = result.find(item=>itemID.id==item.id)						
						itemID.ok(obj)
					})
					
					this.waiting[call]={ids:[]}
				},2)
			})			
		}
		return null
	}
	
	async get(url,params,jwt){			
		//const result = await this.callOptimizer("GET",url,params,jwt)		
		//if(result) return result;		
		if(url.startsWith("/")) url=`${this.gateway}${url}`;

		var headers={}	
		if(this.jwt) 	headers.auth=this.jwt;	
		if(jwt)			headers.auth=jwt;	
		
		url=encodeURI(url);
		try{
			var data = await requestify.get(url,{headers:headers,insecure: true,params:params,timeout:30000})
			return data.getBody();
		}catch(e){
			console.log("services","get",url,e)
			return null;
		}
	}
	async post(url,body,jwt){
		if(url.startsWith("/")) url=`${this.gateway}${url}`;		 

		var headers={}	
		if(this.jwt) 	headers.auth=this.jwt;	
		if(jwt)				headers.auth=jwt;	
		
		url=encodeURI(url);
		console.log("post",">"+url,body,jwt)				
		try{
			var data = await requestify.post(url,body,{headers:headers,insecure: true,timeout:50000})			
			return data.getBody();
		}catch(e){	
			console.log("post",url,e)		
			throw e;
		}		
	}
	async put(url,body,jwt){
		if(url.startsWith("/")) url=`${this.gateway}${url}`;	

		var headers={}	
		if(this.jwt) 	headers.auth=this.jwt;	
		if(jwt)				headers.auth=jwt;	
		
		url=encodeURI(url);
		try{
			var data = await requestify.put(url,body,{headers:headers,insecure: true,timeout:5000})
			return data.getBody();
		}catch(e){
			console.error("services","put",url,e)
			throw e;
		}
	}
	async delete(url,data,jwt){
		if(url.startsWith("/")) url=`${this.gateway}${url}`;	

		var headers={}	
		if(this.jwt) 	headers.auth=this.jwt;	
		if(jwt)				headers.auth=jwt;	
		
		try{
			url=encodeURI(url);
			var data = await requestify.delete(url,{headers:headers,insecure: true,timeout:5000})
		}catch(e){
			console.error("services","delete",this.jwt,jwt,url,e)
			throw e;
		}
		return data.getBody();
	}
	async getString(){
		if(url.startsWith("/")) url=`${this.gateway}${url}`;	

		var headers={}	
		if(this.jwt) 	headers.auth=this.jwt;	
		if(jwt)				headers.auth=jwt;	
		
		url=encodeURI(url);
		var data = await requestify.get(url,{headers:headers,insecure: true,params:params,timeout:5000})
		return data.getBody();
	}
	hateous(obj,name,url,type){
		if(!obj) return;
		if(obj.forEach)
			return obj.forEach(item=>this.hateous(item,name,url,type))

		type=type||"links";
		url = eval('`'+url+'`');

		if(type=="links"){
			if(!obj.links) obj.links=[];
			var link = obj.links.find(item=>item.name==name)
			if(!link)	 obj.links.push({name:name,url:`${this.gateway}${url}`})
			else		Object.assign(link,{name:name,url:`${this.gateway}${url}`})
		}
		
		if(type=="short")
			obj[name]=`${this.gateway}${url}`
	}
	
	image(src){
		return `${this.externalGateway}/2020-09${src}`;
	}
	link(url){
		if(url.startsWith("/")) url=`${this.gateway}${url}`
		return url;
	}
	sendNotification(type, mail, data){
		klaviyo.track(type,mail,data)
	}
	externalLink(path){
		if(!path.startsWith("/")) path="/"+path;			
		return `${this.externalGateway}${path}`;
	}
	externalApi(path){
		if(!path.startsWith("/")) path="/"+path;			
		return `${this.externalGateway}/2021-08${path}`;
	}

	swagger(swagger,dir){
		this.addSwagger(swagger,dir);
	}	
	addSwagger(swagger,dir){
		var servicesRoot=process.cwd()+"/services/2021-08"
		var serviceName = path.relative(servicesRoot,dir);
		this.get(`/api/add?swagger=${swagger}&service=/${serviceName}`)
	}
	toJSON(obj,type){
		if(obj.forEach)
			return obj.map(item=>this.toJSON(item,type))
		else
			if(obj.toJSON)
				return obj.toJSON(type)
			else
				return obj;
	}
}



module.exports.Services=Services;

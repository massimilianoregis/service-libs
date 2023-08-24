var axios = require("axios").create({
    baseURL:"http://localhost:3000",
    headers:{"auth":""}
})

class Call{
    async get(url){
        console.log("axios",url)
        var resp = await axios.get(url);     
        console.log(resp.data)   
        return  resp.data;
    }
}

module.exports=Call
const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

module.exports={
    get:()=>{       
        return (asyncLocalStorage.getStore()||{}).user;
    },
    app:(req,res,next)=>{
        asyncLocalStorage.run({user:req.user},next);
    }
}
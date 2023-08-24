const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

module.exports={
    get:()=>{       
        return (asyncLocalStorage.getStore()||{});
    },
    set:(value,fnc)=>{
        asyncLocalStorage.run(value,fnc);
    }
}
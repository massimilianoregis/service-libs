class Observe{

    static createProxy(obj){
        obj._observers=[]        

        const handler2 = {
            set: function(obj, prop, value) {
                if(obj[prop]!=value)                     
                    obj._observers.forEach(observer=>observer.change(prop,value))

                return Reflect.set(obj,prop,value);
            }
          };

        return new Proxy(obj,handler2)      
    }

    constructor(obj){        
        this.props=new Set();
        obj._observers.push(this);
    }
    change(prop,value){
        this.props.add(prop);
    }
    
    clean(){
        this.props.clear();
    }
    isChanged(){
        return this.props.size>0;
    }

    changes(){
        return Array.from(this.props.keys());
    }
}
module.exports=Observe
/*
var a={
    a:1,
    b:2
}
a = Observe.createProxy(a)

var obs = new Observe(a)

a.c=3
a.d=5
a.d=6

console.log(a)
console.log(obs.changes())
*/
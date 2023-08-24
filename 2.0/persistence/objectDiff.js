const {detailedDiff} =require('deep-object-diff');
/**
 * 
 */
function add(objSource,objTarget,path, diff){
    //console.log("add",path,objSource[path],objTarget[path],path)
    if(objSource[path]==undefined){
        objSource[path]=objTarget[path]
        return;
    }

    for(var i in diff[path])
        add(objSource[path],objTarget[path],i,diff[path])    
}
function updated(objSource,objTarget,path, diff){
    //console.log("updated",path,objSource,objTarget)
    if(!objSource[path]){
        objSource[path]=objTarget[path];
        return;
    }
    if(typeof(objTarget[path])=="string" && objSource[path]!=objTarget[path]){
        objSource[path]=objTarget[path]
        return;
    }
    if(typeof(objTarget[path])=="number" && objSource[path]!=objTarget[path]){
        objSource[path]=objTarget[path]
        return;
    }
    if(typeof(objTarget[path])=="boolean" && objSource[path]!=objTarget[path]){
        objSource[path]=objTarget[path]
        return;
    }

    for(var i in diff[path])
        updated(objSource[path],objTarget[path],i,diff[path])    
}
function deleted(objSource,objTarget,path, diff){            
    if(objTarget[path]==undefined){                
        if(Array.isArray(objSource)) {
            try{objSource[parseInt(path)].remove()}catch(e){}
            objSource.splice(parseInt(path),1)            
        }
        else delete objSource[path];
        
        return;
    }

    for(var i in diff[path])
        deleted(objSource[path],objTarget[path],i,diff[path])    
}

function diff(objSource,objTarget){
    /**
     * objSource is the obj loaded from the dbase
     * objTarget is the obj loaded from json body
     *
     * the tool to compare the two object is this one:
     * https://github.com/mattphillips/deep-object-diff#readme
    **/ 

    //this row obtains a differences between the two objects
    var diff = detailedDiff(objSource,objTarget);
    //console.log("diff",JSON.stringify(diff,2,2))
    
    for(var i in diff.deleted)
        deleted(objSource,objTarget,i,diff.deleted)   
    for(var i in diff.added)
        add(objSource,objTarget,i,diff.added)              
    for(var i in diff.updated)
        updated(objSource,objTarget,i,diff.updated)  

    
}


module.exports=diff;
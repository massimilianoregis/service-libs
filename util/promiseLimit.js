function promiseAllStepN(n, list) {
    let tail = list.splice(n)
    let head = list
    let resolved = []
    let processed = 0
    return new Promise(resolve=>{
      if(list.length==0) return resolve([]);
      head.forEach(x=>{
        let res = x()
        resolved.push(res)
        res.then(y=>{
          runNext()
          return y
        })
      })
      function runNext(){
        if(processed == tail.length){
          resolve(Promise.all(resolved))
        }else{
          resolved.push(tail[processed]().then(x=>{
            runNext()
            return x
          }))
          processed++
        }
      }
    })
  }
  Promise.allConcurrent = n => list =>  promiseAllStepN(n, list)
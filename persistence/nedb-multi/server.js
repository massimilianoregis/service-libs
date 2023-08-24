const axon = require('../../axon');

const handler = require('./lib/handler');

const port = Number(process.env.NEDB_MULTI_PORT) || Number(process.argv[2]);
const dbsMap = new Map();
const repSocket = axon.socket('rep');
const messagesHandler = handler.create(dbsMap);

repSocket.bind(port);
console.log(`rpc listen on port ${port}`)

var app= require("express")();
    app.get("/",(req,res,next)=>{
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        const memory = Math.round(used * 100) / 100;
        res.json({
            memory:`${memory} MB`,
            dbs:Array.from(dbsMap.keys()).map(key=>({
                name:key,
                loaded:dbsMap.get(key)?true:false            
            }))
        })
    }) 
    app.get("/unload",(req,res,next)=>{
        dbsMap.set(req.query.db,null)
        res.json(Array.from(dbsMap.keys()))
    })
    app.get("/load",(req,res,next)=>{
        const DataStore = require('../nedb');
        var name = req.query.db
        var db = new DataStore({filename: name,autoload: true});
        dbsMap.set(name,db)
        res.json(Array.from(dbsMap.keys()))
    })
app.listen(3332)

console.log(`app listen on port 3332`)

repSocket.on('message', messagesHandler);
module.exports.Datastore = require("./persistence/nedb")
module.exports.Nedb = require("./persistence/nedbAdapter").NedbAdapter
/* 
    this is the persistence class
    you can create a persitence object just with inherit Document

    static get({}) in order to get an object
    static find({}) a list of objects
    delete()
*/
module.exports.Document = require("./persistence/persistence").Document
//module.exports.Document = require("./persistence/DocumentDataSet").Document
/* this classes is used in order to create a basic http rules
    GET /
    GET /<id>
    POST /
    PUT  /<id>
    DELETE /<id>

    new Rest(<Document Object>)
*/
module.exports.Rest = require("./http/rest").Rest
module.exports.Config = require("./http/config").Config
module.exports.Services = require("./http/services").Services
module.exports.Service = require("./http/service").Service
module.exports.Cluster = require("./cluster/rpc").Cluster
module.exports.User = require("./user")
module.exports.UDP={
    Call:require("./util/udp/Call")
}
module.exports.S3 = require("./aws/s3");

module.exports["2.0"]=require("./2.0");
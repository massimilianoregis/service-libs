const DataStore = require('../../nedb');
const errio = require('errio');

const utils = require('./utils');
const constants = require('./constants');

const replyCallback = reply => (...args) => {
  if (args[0] !== null) {
    args[0] = errio.stringify(args[0]); // eslint-disable-line no-param-reassign
  }

  reply(...args);
};

exports.create = dbsMap => (options, method, dataOnlyArgs, reply) => {
  const { filename } = options;
  let db = dbsMap.get(filename);

  if (method === 'unloadDatabase'){
    console.log("multi-db",method,dataOnlyArgs)
    dbsMap.delete(filename)
    return;
  }
  if (method === 'loadDatabase' && db) {   
    reply();
    return;
  }
  
  if (method === 'loadDatabase' && !db) {    
    console.log("multi-db",method,options)
    db = new DataStore(options);
    dbsMap.set(filename, db);
  } else if (!db) {
    db = new DataStore(options);    
    dbsMap.set(filename, db);    
    db.loadDatabase(()=>{});
    //reply(errio.stringify(new Error('Call loadDatabase() first.')));
    //return;
  }
  if(!db) return;
  
  if (method === constants.EXECUTE_CURSOR_PRIVATE) {
    const cursor = dataOnlyArgs[dataOnlyArgs.length - 1];
    utils.execCursor(cursor, db, replyCallback(reply));
  } else if (method === constants.PERSISTENCE_COMPACT_DATAFILE) {
    db.persistence.compactDatafile();
  } else if (method === constants.PERSISTENCE_SET_AUTOCOMPACTION_INTERVAL) {
    db.persistence.setAutocompactionInterval(...dataOnlyArgs);
  } else if (method === constants.PERSISTENCE_STOP_AUTOCOMPACTION) {
    db.persistence.stopAutocompaction();
  }else {    
    console.log("multi-db",method,dataOnlyArgs)
    db[method].call(db, ...dataOnlyArgs, replyCallback(reply));
  }
};

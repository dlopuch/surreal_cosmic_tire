"use strict";

const async = require('async');
const db = require('../data/db');

db.dbReady.then((db) => {
  db.serialize(() => {

    async.series([
      cb => {
        db.run(`CREATE TABLE file_meta (
          guid TEXT PRIMARY KEY NOT NULL,
          is_file_uploaded BOOLEAN DEFAULT false,
          description TEXT,
          extension TEXT,
          tags TEXT
        )`, cb);
      },
      cb => {
        db.run(`CREATE TABLE file_data (
          meta_guid TEXT NOT NULL, 
          file BLOB,
          FOREIGN KEY (meta_guid) REFERENCES file_meta (guid) ON DELETE CASCADE
        )`, cb);
      }
    ], (error) => {
      if (error) {
        console.log('ERROR CREATING TABLES:', error);
        return;
      }

      console.log('success');
      db.close();
    });
  });
});
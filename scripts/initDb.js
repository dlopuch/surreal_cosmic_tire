"use strict";

const async = require('async');
const db = require('../io/db');

db.dbReady.then((db) => {
  db.serialize(() => {

    async.series([
      cb => {
        db.run(`CREATE TABLE file_meta (
          guid TEXT PRIMARY KEY NOT NULL,
          created_at DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          uploaded_at DATE DEFAULT null,
          is_file_uploaded BOOLEAN DEFAULT false,
          is_meta_expired BOOLEAN DEFAULT false,
          description TEXT NOT NULL,
          extension TEXT NOT NULL,
          tags TEXT
        )`, cb);
      },
      cb => {
        db.run(`CREATE TABLE file_data (
          meta_guid TEXT NOT NULL, 
          file BLOB NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type TEXT NOT NULL,
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
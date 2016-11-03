const async = require('async');
const fs = require('fs');
const multer = require('multer');
const router = require('express').Router();
const uuid = require('node-uuid');

const db = require('../io/db').db;
const logger = require('../io/logger');

module.exports = router;

// Configuration.
// TODO: Formal app would have this environment specific or in a unified configuration file
const MAX_DESCRIPTION_LENGTH = 255;
const MAX_EXTENSION_LENGTH = 255;

/* One you submit metadata, the upload must be submitted within this time period */
const MS_BEFORE_UPLOAD_REQUIRED = 30000;

/**
 * ENDPOINT: Create a placeholder for a new file by submitting metadata.
 * Responds with a file_id.
 */
router.post('/file', function(req, res, next) {
  let validationErrors = [];

  let $description;
  if (!req.body.description || typeof req.body.description !== 'string') {
    validationErrors.push('Missing description');
  } else {
    $description = req.body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
  }

  let $extension;
  if (!req.body.extension || typeof req.body.extension !== 'string') {
    validationErrors.push('Missing expected extension');
  } else {
    // TODO: Perhaps project requirements would have a whitelist of allowed extensions.
    $extension = req.body.extension.trim().slice(0, MAX_EXTENSION_LENGTH);
  }

  let $tags;
  if (!req.body.tags || typeof req.body.tags !== 'string' || !req.body.tags.trim()) {
    $tags = null;
  } else {
    $tags = req.body.tags
      .split(',')
      .map(t => t.trim())
      .join(',');
  }

  if (validationErrors.length) {
    res
      .status(400)
      .send({ error: validationErrors });
    return;
  }

  let $guid = uuid.v4();


  // TODO: In a formal app, this would be broken down into a common data access layer, no DB in endpoint-specific MW
  db().run(`
    INSERT INTO file_meta (guid, is_file_uploaded, description, extension, tags) 
    VALUES ($guid, 0, $description, $extension, $tags)`,
    { $guid,
      $description,
      $extension,
      $tags
    },
    function(error, results) {
      if (error) {
        logger.log('Error storing meta', error);
        return next(error);
      }

      res.status(200).json({ status: 'ok', fileId: $guid });
    }
  );
});

/**
 * ENDPOINT: Get the file metadata that was submitted
 */
router.get('/file/:fileId', function(req, res, next) {
  db().get(`SELECT * FROM file_meta WHERE guid = ?`, req.params.fileId, (error, results) => {
    if (error) {
      logger.log('Error getting meta', error);
      return next(error);
    }

    if (!results) {
      logger.log(`No results found for fileId ${req.params.fileId}`);
      return res.status(404).send();
    }

    // TODO: Again, this kind of object translation would be done in a formal data access layer, not endpoint-specific MW
    return res.status(200).json({
      fileId: results.guid,
      description: results.description,
      extension: results.extension,
      tags: results.tags ? results.tags.split(',') : null,
    });
  });
});

/**
 * ENDPOINT: Get the file blob that was submitted
 */
router.get('/file/:fileId/data', function(req, res, next) {
  db().get(`SELECT file, mime_type FROM file_data WHERE meta_guid = ?`, req.params.fileId, (error, results) => {
    if (error) {
      logger.log('Error getting file', error);
      return next(error);
    }

    if (!results) {
      logger.debug(`No results found for fileId ${req.params.fileId}`);
      return res.status(404).send();
    }

    return res
      .status(200)
      .set('Content-Type', results.mime_type)
      .send(results.file);
  });
});


const fileUploadMulter = multer({
  storage: multer.memoryStorage(), // careful with file limits -- too high could cause out-of-memory errors!
  limits: {
    fields: 1,
    fieldSize: 1024 * 1024,

    files: 1,
    fileSize: 1024 * 1024,
  }
});

/**
 * ENDPOINT: Uploads a file with a known fileId.  File must be submitted under form name 'passport'.
 *
 * To test:
 *   curl -X PUT --form "passport=@some_file.txt" localhost:3000/api/file/:fileId
 */
router.put('/file/:fileId', fileUploadMulter.single('passport'), function(req, res, next) {
  async.waterfall([
    function getFileMeta(callback) {
      db().get('SELECT * FROM file_meta WHERE guid = ?', req.params.fileId, (error, results) => {
        if (error) return callback(error);

        if (!results) {
          let e = new Error('File not found');
          e.status = 404;
          return callback(e);
        }

        callback(null, results);
      });
    },
    function validateFile(fileMeta, callback) {
      // Filesize already checked in multer mw that accepted the request.

      if (fileMeta.is_file_uploaded) {
        let e = new Error('File already submitted');
        e.status = 400;
        return callback(e);
      }

      // Requirement: Uploads have a fixed expiration.  Reject the request if past expiration time.
      let createdDate = new Date(`${fileMeta.created_at}Z`);
      if (Date.now() - createdDate > MS_BEFORE_UPLOAD_REQUIRED) {
        let e = new Error('File descriptor expired, please request another upload.');
        e.status = 400;
        return db().run(
          'UPDATE file_meta SET is_meta_expired = 1 WHERE guid = ?', req.params.fileId,
          (error) => callback(error || e)
        );
      }

      // Requirement: check extension matches
      if (!req.file.originalname) {
        let e = new Error('Missing filename!');
        e.status = 400;
        return callback(e);
      } else if (req.file.originalname.substring(req.file.originalname.lastIndexOf('.') + 1) !== fileMeta.extension) {
        let e = new Error(`Filename does match expected extension. Expected a .${fileMeta.extension} file, got .${
            req.file.originalname.substring(req.file.originalname.lastIndexOf('.') + 1)
          }!`);
        e.status = 400;
        console.log(fileMeta, callback, arguments[3]);
        return callback(e);
      }

      // TODO: Could perform mimetype whitelist with req.file.mimetype, but that also can be easily spoofed

      return callback(null, fileMeta);
    },
    function persistFile(fileMeta, callback) {
      async.series([
        (cb) => db().run('BEGIN', cb),
        (cb) => db().run(
          `INSERT INTO file_data (meta_guid, file, file_size, mime_type) VALUES ($guid, $fileBlob, $filesize, $mime)`,
          { $guid: fileMeta.guid,
            $fileBlob: req.file.buffer,
            $filesize: req.file.size,
            $mime: req.file.mimetype,
          },
          cb
        ),
        (cb) => db().run(
          `UPDATE file_meta SET is_file_uploaded = 1, uploaded_at = datetime() WHERE guid = ?`, fileMeta.guid, cb
        ),
        (cb) => db().run('COMMIT', cb)
        ], (error) => callback(error)
      );
    }
  ], function(error) {
    if (error) {
      if (!error.status) {
        return next(error);
      }

      res.status(error.status).json({ error: error.message });
      return;
    }

    res.status(200).json({ fileId: req.params.fileId });
  });
});

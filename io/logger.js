// Generic interface for loggers.  For demo purposes, just using console logger.  Later can swap out with otehrs.

exports.log   = function() { console.log.apply(this, Array.from(arguments)); };
exports.info  = function() { console.log.apply(this, Array.from(arguments)); };
exports.debug = function() { console.log.apply(this, Array.from(arguments)); };
exports.warn  = function() { console.log.apply(this, Array.from(arguments)); };
exports.error = function() { console.log.apply(this, Array.from(arguments)); };
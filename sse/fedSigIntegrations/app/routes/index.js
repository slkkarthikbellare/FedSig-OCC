module.exports = function(app) {

  'use strict';

  var fs = require('fs');

  fs.readdir(__dirname, loadRoutes);

  function loadRoutes(error, files) {
    if (error) {
      throw error;
    } else {
      files.forEach(requireRoute);
    }
  }

  function requireRoute(file) {
    // Remove the file extension
    var f = file.substr(0, file.lastIndexOf('.'));
    // Do not require index.js (this file)
    if (f !== 'index') {
      // Require the controller
	  console.log("Adding route..." + f);
      require('./' + f)(app);
    }
  }

};
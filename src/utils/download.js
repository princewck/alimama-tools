const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
function download(url, path) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br'
      }
    }).then(res => {
      const dest = fs.createWriteStream(path);
      const stream = res.body.pipe(dest);
      stream.on('finish',() => {
        resolve(path);
      });
      stream.on('error', (err) => {
        reject(err);
      });
    }, (e) => {
      reject(e);
    });
  });
}

module.exports = download;
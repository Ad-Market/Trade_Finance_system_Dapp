ipfsdownload: function(hash, response) {
  ipfs.get(hash, function(err, stream) {
    if (err) {
      console.log('File not found by IPFS');
      console.error(err);
      return response.send(err);
    }

    response.writeHead(200, {
      'Content-Disposition': 'attachment'
    });
    stream.on('data', (file) => {
      // write the file's path and contents to standard out
      file.content.pipe(response);
    });
  })
}

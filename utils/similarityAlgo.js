function similarityAlgo(embeddings, waitingClients) {
  var ind = -1;
  var maxsim = 0;
  var j = 0;
  waitingClients.forEach((client) => {
    var sim = 0;
    for (var i = 0; i < embeddings.length; i++) {
      sim += embeddings[i] * client.embeddings[i];
    }
    if (sim > maxsim) {
      maxsim = sim;
      ind = j;
    }
    j++;
  });
  console.log(maxsim);
  if (maxsim > 0.85) return ind;

  return -1;
}
module.exports = similarityAlgo;

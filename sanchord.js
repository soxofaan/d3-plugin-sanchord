d3.layout.sanchord = function () {
  var chord = {};
  var nodes, chords;
  var matrix, n;
  var nodePadding = 0, ioPadding = 0;
  var sortNodes, sortFlows;

  function reset() {
    chords = nodes = null;
  }

  function relayout() {
    // Order of groups (the nodes visualized as arc, between which the chords flow).
    var nodeIndices = d3.range(n);

    // Compute the group and total sizes.
    var nodeSums = [];
    var nodeInputSums = [];
    var nodeOutputSums = [];
    for (var ni = 0; ni < n; ni++) {
      var inputSum = 0;
      var outputSum = 0;
      for (var i = 0; i < n; i++) {
        inputSum += matrix[i][ni];
        outputSum += matrix[ni][i];
      }
      nodeSums.push(inputSum + outputSum);
      nodeInputSums.push(inputSum);
      nodeOutputSums.push(outputSum);
    }
    var totalSum = d3.sum(nodeSums);

    // Optionally: sort nodes by weight.
    if (sortNodes) {
      nodeIndices.sort(function (a, b) {
        return sortNodes(nodeSums[a], nodeSums[b]);
      });
    }

    // Order of in/out flows by node.
    var inFlowIndices = [];
    var outFlowIndices = [];
    nodeIndices.forEach(function (ni, nii) {
      outFlowIndices.push(nodeIndices.slice((nii + 1) % n).concat(nodeIndices.slice(0, (nii + 1) % n)).reverse());
      inFlowIndices.push(nodeIndices.slice(nii).concat(nodeIndices.slice(0, nii)).reverse());
    });

    // Optionally: sort flows by weight within each node.
    if (sortFlows) {
      outFlowIndices.forEach(function (d, i) {
        d.sort(function (a, b) {
          return sortFlows(matrix[i][a] + matrix[a][i], matrix[i][b] + matrix[b][i]);
        });
      });
      // Inflows in reverse order.
      inFlowIndices.forEach(function (d, i) {
        d.sort(function (a, b) {
          return -sortFlows(matrix[i][a] + matrix[a][i], matrix[i][b] + matrix[b][i]);
        });
      });
    }

    // Convert the sum to scaling factor for [0, 2pi].
    // TODO Allow start and end angle to be specified.
    // TODO Allow padding to be specified as percentage?
    var k = (2 * Math.PI - (nodePadding + ioPadding) * n) / totalSum;

    // Compute the start and end angle for each node's arc and flow chords.
    nodes = [];
    var inFlows = [];
    var outFlows = [];
    var r = 0, ri, ro, rf0;
    nodeIndices.forEach(function (ni) {
      ri = r;
      // Incoming flows.
      inFlowIndices[ni].forEach(function (fi) {
        var value = matrix[fi][ni];
        rf0 = r;
        r += value * k;
        inFlows[fi + '-' + ni] = {
          outIndex: fi,
          inIndex: ni,
          startAngle: rf0,
          endAngle: r,
          value: value
        };
      });
      var nodeInput = {
        index: ni,
        startAngle: ri,
        endAngle: r,
        value: nodeInputSums[ni]
      };
      r += ioPadding;
      ro = r;
      // Outgoing flows.
      outFlowIndices[ni].forEach(function (fi) {
        var value = matrix[ni][fi];
        rf0 = r;
        r += value * k;
        outFlows[ni + '-' + fi] = {
          outIndex: ni,
          inIndex: fi,
          startAngle: rf0,
          endAngle: r,
          value: value
        };
      });
      var nodeOutput = {
        index: ni,
        startAngle: ro,
        endAngle: r,
        value: nodeOutputSums[ni]
      };
      // Node's input and output flow arcs.
      nodes[ni] = {
        index: ni,
        input: nodeInput,
        output: nodeOutput,
        total: {
          index: ni,
          startAngle: ri,
          endAngle: r,
          value: nodeSums[ni]
        }
      };
      r += nodePadding;
    });

    // Generate chords for each (non-empty) subgroup-subgroup link.
    chords = [];
    for (var ofi = 0; ofi < n; ofi++) {
      for (var ifi = 0; ifi < n; ifi++) {
        var source = outFlows[ofi + '-' + ifi];
        var target = inFlows[ofi + '-' + ifi];
        if (source.value) {
          chords.push({source: source, target: target});
        }
      }
    }

  }


  chord.matrix = function (x) {
    if (!arguments.length) return matrix;
    n = (matrix = x) && matrix.length;
    reset();
    return chord;
  };

  chord.nodePadding = function (x) {
    if (!arguments.length) return nodePadding;
    nodePadding = x;
    reset();
    return chord;
  };
  chord.ioPadding = function (x) {
    if (!arguments.length) return ioPadding;
    ioPadding = x;
    reset();
    return chord;
  };

  chord.sortNodes = function (x) {
    if (!arguments.length) return sortNodes;
    sortNodes = x;
    reset();
    return chord;
  };

  chord.sortFlows = function (x) {
    if (!arguments.length) return sortFlows;
    sortFlows = x;
    reset();
    return chord;
  };

  chord.chords = function () {
    if (!chords) relayout();
    return chords;
  };

  chord.nodes = function () {
    if (!nodes) relayout();
    return nodes;
  };

  return chord;
};

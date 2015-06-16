d3.layout.sanchord = function () {
  var sanchord = {};
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
        inFlows[fi + "-" + ni] = {
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
        outFlows[ni + "-" + fi] = {
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
      var throughput = Math.min(nodeInputSums[ni], nodeOutputSums[ni]);
      var dropOff = nodeInputSums[ni] - throughput;
      var dropIn = nodeOutputSums[ni] - throughput;
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
        },
        throughput: {
          startAngle: (ro - ioPadding) - k * throughput,
          endAngle: ro + k * throughput,
          value: throughput
        },
        dropOff: {
          startAngle: ri,
          endAngle: ri + k * dropOff,
          value: dropOff
        },
        dropIn: {
          startAngle: r - k * dropIn,
          endAngle: r,
          value: dropIn
        }
      };

      r += nodePadding;
    });

    // Generate chords for each (non-empty) subgroup-subgroup link.
    chords = [];
    for (var ofi = 0; ofi < n; ofi++) {
      for (var ifi = 0; ifi < n; ifi++) {
        var source = outFlows[ofi + "-" + ifi];
        var target = inFlows[ofi + "-" + ifi];
        if (source.value) {
          chords.push({source: source, target: target});
        }
      }
    }

  }


  sanchord.matrix = function (x) {
    if (!arguments.length) return matrix;
    n = (matrix = x) && matrix.length;
    reset();
    return sanchord;
  };

  sanchord.nodePadding = function (x) {
    if (!arguments.length) return nodePadding;
    nodePadding = x;
    reset();
    return sanchord;
  };
  sanchord.ioPadding = function (x) {
    if (!arguments.length) return ioPadding;
    ioPadding = x;
    reset();
    return sanchord;
  };

  sanchord.sortNodes = function (x) {
    if (!arguments.length) return sortNodes;
    sortNodes = x;
    reset();
    return sanchord;
  };

  sanchord.sortFlows = function (x) {
    if (!arguments.length) return sortFlows;
    sortFlows = x;
    reset();
    return sanchord;
  };

  sanchord.chords = function () {
    if (!chords) relayout();
    return chords;
  };

  sanchord.nodes = function () {
    if (!nodes) relayout();
    return nodes;
  };

  // Helper function to build path generator of node arcs.
  function nodeArc(type) {
    return d3.svg.arc()
      .startAngle(function (d) {
        return d[type].startAngle;
      })
      .endAngle(function (d) {
        return d[type].endAngle;
      });
  }

  // Path generator for node input arcs.
  sanchord.inputArc = function () {
    return nodeArc('input');
  };

  // Path generator for node output arcs.
  sanchord.outputArc = function () {
    return nodeArc('output');
  };

  // Path generator for node throughputs.
  sanchord.throughput = function () {
    var r = 1;

    function throughput(d) {
      var a0 = d.throughput.startAngle - 0.5 * Math.PI;
      var a1 = d.throughput.endAngle - 0.5 * Math.PI;
      var am = (a0 + a1) / 2;
      var ad = Math.abs(a0 - a1);
      var br = 1 + 0.5 * ad;
      var sr = 0.2 * ad * ad;
      var x0 = r * Math.cos(a0);
      var y0 = r * Math.sin(a0);
      var xm = r * Math.cos(am);
      var ym = r * Math.sin(am);
      var x1 = r * Math.cos(a1);
      var y1 = r * Math.sin(a1);
      var xi = r * Math.cos(am - ioPadding / 2);
      var yi = r * Math.sin(am - ioPadding / 2);
      var xo = r * Math.cos(am + ioPadding / 2);
      var yo = r * Math.sin(am + ioPadding / 2);
      var rio = Math.sqrt((xm - xi) * (xm - xi) + (ym - yi) * (ym - yi));

      return (
        "M" + [x0, y0].join(",") +
        "C" + [br * x0, br * y0, br * (xm + sr * ym), br * (ym - sr * xm), br * xm, br * ym].join(",") +
        "S" + [br * x1, br * y1, x1, y1].join(",") +
        "A" + [r, r, 0, 0, 0, xo, yo].join(",") +
        "A" + [rio, rio, 0, 0, 0, xi, yi].join(",") +
        "A" + [r, r, 0, 0, 0, x0, y0].join(",") +
        "Z"
      );
    }

    throughput.radius = function (x) {
      if (!arguments.length) return r;
      r = x;
      return throughput;
    };

    return throughput;
  };

  // Helper function to build path generator functions for the drop-off and drop-in flows.
  function drop(type) {
    var innerRadius = 1;
    var outerRadius = 1.1;

    function drop(d) {
      if (d[type].value) {
        var a0 = d[type].startAngle - 0.5 * Math.PI;
        var a1 = d[type].endAngle - 0.5 * Math.PI;
        var am = (a0 + a1) / 2;
        var x0 = innerRadius * Math.cos(a0);
        var y0 = innerRadius * Math.sin(a0);
        var x1 = innerRadius * Math.cos(a1);
        var y1 = innerRadius * Math.sin(a1);
        var xm = (x0 + x1) / 2;
        var ym = (y0 + y1) / 2;
        var xmm = (type == "dropOff" ? (innerRadius + outerRadius) / 2 : outerRadius ) * Math.cos(am);
        var ymm = (type == "dropOff" ? (innerRadius + outerRadius) / 2 : outerRadius ) * Math.sin(am);
        var xe = (type == "dropOff" ? outerRadius : (innerRadius + outerRadius) / 2) * Math.cos(am);
        var ye = (type == "dropOff" ? outerRadius : (innerRadius + outerRadius) / 2) * Math.sin(am);
        return (
          "M" + [x0, y0].join(",") +
          "L" + [xmm + x0 - xm, ymm + y0 - ym].join(",") +
          "L" + [xe, ye].join(",") +
          "L" + [xmm + x1 - xm, ymm + y1 - ym].join(",") +
          "L" + [x1, y1].join(",") +
          "A" + [innerRadius, innerRadius, 0, 0, 0, x0, y0].join(",") +
          "Z"
        );
      }
    }

    drop.innerRadius = function (x) {
      if (!arguments.length) return innerRadius;
      innerRadius = x;
      return drop;
    };

    drop.outerRadius = function (x) {
      if (!arguments.length) return outerRadius;
      outerRadius = x;
      return drop;
    };

    return drop;

  }

  // Path generator for drop-off flows
  sanchord.dropOff = function () {
    return drop('dropOff');
  };

  // Path generator for drop-in flows
  sanchord.dropIn = function () {
    return drop('dropIn');
  };

  // Path generator for node flow direction arrows.
  sanchord.nodeArrow = function () {
    // Minimum angle (in radians) an arc should have to get an arrow.
    var minAngle = .025;
    // Maximum angle (in radians) an arrow should span.
    var maxAngle = .5;
    // (Maximum) fraction the arrow should span in the arc.
    var fraction = .618;
    // Inner and outer radius for the arrow head and tails.
    var innerRadius = 1.02;
    var outerRadius = 1.08;
    // For which node flow part should we draw an arrow? "input", "output" or "both"?
    var type = "both";

    // Helper function for input/output arc arrows.
    function arrowPath(a0, a1, r0, r1) {
      var ac = (a0 + a1) / 2 - 0.5 * Math.PI;
      var ad = Math.min(maxAngle, fraction * Math.abs(a0 - a1)) / 2;
      if (2 * ad > minAngle) {
        return (
          "M" + [r0 * Math.cos(ac - ad), r0 * Math.sin(ac - ad)].join(",") +
          "L" + [r1 * Math.cos(ac), r1 * Math.sin(ac)].join(",") +
          "L" + [r0 * Math.cos(ac + ad), r0 * Math.sin(ac + ad)].join(",")
        );
      }
      else {
        return '';
      }
    }

    function nodeArrow(d) {
      path = '';
      if (type == "input" || type == "both") {
        path += arrowPath(d.input.startAngle, d.input.endAngle, innerRadius, outerRadius);
      }
      if (type == "output" || type == "both") {
        path += arrowPath(d.output.startAngle, d.output.endAngle, outerRadius, innerRadius);
      }
      return path;
    }

    nodeArrow.innerRadius = function (x) {
      if (!arguments.length) return innerRadius;
      innerRadius = x;
      return nodeArrow;
    };

    nodeArrow.outerRadius = function (x) {
      if (!arguments.length) return outerRadius;
      outerRadius = x;
      return nodeArrow;
    };

    nodeArrow.type = function (x) {
      if (!arguments.length) return type;
      type = x;
      return nodeArrow;
    };

    return nodeArrow;
  };

  // Convenience functions
  sanchord.inputArrow = function () {
    return sanchord.nodeArrow().type('input');
  };

  sanchord.outputArrow = function () {
    return sanchord.nodeArrow().type('output');
  };

  return sanchord;
};

/*jshint unused: false*/

Viva.Graph.Layout = Viva.Graph.Layout || {};
Viva.Graph.Layout.circular = function(graph, settings) {

    var graphRect = {
            x1 : settings.radius,
            y1 : settings.radius,
            x2 : settings.radius,
            y2 : settings.radius
        },
        nodesPositions = [];

    if (!graph) {
        throw {
            message: 'Graph structure cannot be undefined'
        };
    }

    var initNodePositions = function() {
        var nodesCount = graph.getNodesCount(),
            angleStep,
            angle = 0,
            i = 0,
            radius = settings.radius,
            center = settings.center; // TODO

        if (nodesCount === 0) {
            return;
        }

        angleStep = 2 * Math.PI / nodesCount;

        graph.forEachNode(function(node) {
            node.position = {
                angle : angle,
                x : center.x + radius * Math.cos(angle),
                y : center.y + radius * Math.sin(angle),
                i : i++,
            };
            nodesPositions.push({ x : node.position.x, y : node.position.y});
            angle += angleStep;
        });
    },

    barycenter = function(nodeId) {
        var x = 0, y = 0,
            linksNum = graph.getLinks(nodeId).length;

        graph.forEachLinkedNode(
            nodeId,
            function(node, link) {
                x += node.position.x;
                y += node.position.y;
            }
        );

        x /= linksNum;
        y /= linksNum;

        return {
            x : x,
            y : y,
            angle : Math.atan((y - settings.center.y) / (x - settings.center.x))
        };
    },
    compareInts = function(i1, i2) {
        if (i1 > i2) {
            return 1;
        }
        if (i1 < i2) {
            return -1;
        }
        return 0;
    },
    compareNodes = function(node1, node2) {
        if (node1.position.dx > 0) {
            if (node2.position.dx > 0) {
                return compareInts(node1.position.dy,node2.position.dy);
            } else {
                return 1;
            }
        } else {
            if (node2.position.dx < 0) {
                return compareInts(node2.position.dy,node1.position.dy);
            } else {
                return -1;
            }
        }
    },

    alignNodes = function() {

        var nodes = [];

        graph.forEachNode(function(node) {
            var x = node.position.x - settings.center.x,
                y = node.position.y - settings.center.y;
            var r = Math.sqrt(x * x + y * y);
            node.position.x = settings.center.x + settings.radius * x / r;
            node.position.y = settings.center.y + settings.radius * y / r;
            node.position.dx = node.position.x - settings.center.x;
            node.position.dy = node.position.y - settings.center.y;
            nodes.push(node);
        });

        nodes.sort(compareNodes);

        for (var i = 0 ; i < nodes.length ; ++i) {
            nodes[i].position = { x : nodesPositions[i].x, y : nodesPositions[i].y, i : i};
        }
    },

    alignCounter = 0,
    updateNodePosition = function(nodeId) {
        var node = graph.getNode(nodeId),
            alignCounterLim = 4;
        node.position = barycenter(nodeId);
        node.position.x = settings.center.x + settings.radius * Math.cos(node.position.angle);
        node.position.y = settings.center.y + settings.radius * Math.sin(node.position.angle);
    },

    savePositions = function() {
        var result = [];

        graph.forEachNode(function(node) {
            result.push(node.i); // TODO: Why there is no getNodes() function?
        });

        return result;
    },

    /*setPositions = function(positions) {
        for (var i = 0 ; i < positions.length ; ++i) {
            graph.getNode(positions[i]).position = nodesPositions[i];
        }
    },*/

    positionsEqual = function(positions1, positions2) {
        for (var i = 0 ; i < positions1.length ; ++i) {
            if (positions1[i] !== positions2[i]) {
                return false;
            }
        }
        return true;
    },

    computeEdgeLength = function() {
        var length = 0,
            from, to,
            xdiff, ydiff;

        graph.forEachLink(function(link) {
            from = graph.getNode(link.fromId);
            to = graph.getNode(link.toId);
            xdiff = to.position.x - from.position.x;
            ydiff = to.position.y - from.position.y;
            length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
        });

        return length;
    },

    bestEdgeLength, bestPositions;

    initNodePositions();

    //bestPositions = savePositions();
    bestEdgeLength = computeEdgeLength();
    console.log(bestEdgeLength);
    var ii = 0, iin = 15;
    return {

        run: function() {
            var continueRun = true;

            do {
                continueRun = this.step();
            } while(continueRun);
        },

        step: function() {
            var previousPositions = savePositions(),
                newPositions, newEdgeLength;

            var updateNode = function(node) {
                updateNodePosition(node.id);
                //alignNodes();
            };
            for (; ii !== iin; ii++) {
                graph.forEachNode(updateNode);
            }

            alignNodes();

            newPositions = savePositions();
            newEdgeLength = computeEdgeLength();
            console.log(newEdgeLength);
            /*if (newEdgeLength < bestEdgeLength) {
                bestPositions = newPositions;
            }*/

            if (positionsEqual(previousPositions, newPositions)) {
                //setPositions(bestPositions);
                //newEdgeLength = computeEdgeLength();
                //console.log(newEdgeLength);
                return true;
            }

            return true;
        },


        /**
         * Returns rectangle structure {x1, y1, x2, y2}, which represents
         * current space occupied by graph.
         */
        getGraphRect: function() {
            return graphRect;
        },

        /**
         * Request to release all resources
         */
        dispose: function() {
        }
    };
};


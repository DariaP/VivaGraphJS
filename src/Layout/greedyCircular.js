/*jshint unused: false*/
/*jshint -W083 */

Viva.Graph.Layout = Viva.Graph.Layout || {};
Viva.Graph.Layout.greedyCircular = function(graph, settings) {

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

    var getPickNodeFunction = function(nodes) {

        // elements are compared according to the number of unplaced neighbors
        // (choose one with the lower number)
        // ties are broken according to the number of placed neighbors.
        // (choose one with the higher number)
        var compareHeapElements = function(element1, element2) {
            if (element1.unplacedNodesNumber > element2.unplacedNodesNumber ) {
                return 1;
            }

            if (element1.unplacedNodesNumber < element2.unplacedNodesNumber ) {
                return -1;
            }

            // element1.unplacedNodesNumber === element2.unplacedNodesNumber

            if (element1.placedNodesNumber < element2.placedNodesNumber) {
                return 1;
            }

            if (element1.placedNodesNumber > element2.placedNodesNumber) {
                return -1;
            }

            return 0;
        },
        heap = Viva.Graph.Utils.heap(compareHeapElements),
        heapElement;

        for (var i = 0 ; i < nodes.length ; ++i) {
            nodes[i].neighbors = [];
            nodes[i].placedNodesNumber = 0;

            graph.forEachLinkedNode(
                nodes[i].id,
                function(linkedNode) {
                    nodes[i].neighbors.push(linkedNode);
                }
            );

            nodes[i].unplacedNodesNumber = nodes[i].neighbors.length;

            heap.push(nodes[i]);
        }
        return function() {
            var pickedNode = heap.pop();

            for (i = 0 ; i < pickedNode.neighbors.length ; ++i) {
                pickedNode.neighbors[i].placedNodesNumber++;
                pickedNode.neighbors[i].unplacedNodesNumber--;
                heap.update(pickedNode.neighbors[i]);
            }

            return pickedNode;
        };
    },

    // Select side (left or right) 
    // to mininize number of new crossings
    // and put node on layout
    // nodesInLayout is sorted from left to right 
    // and will be updated according to decision
    greedyAddNode = function(nodesInLayout, newNode) {
        var leftCrossingsNumber = 0,
            rightCrossingsNumber = 0,
            leftNeighborsNumber = 0,
            rightNeighborsNumber = newNode.placedNodesNumber,
            nextNode,
            i, j;

        console.log('adding ' + newNode.id);

        for (i = 0 ; i < nodesInLayout.length ; ++i) {
            nodesInLayout[i].currentNeighbor = false;
        }

        for (j = 0 ; j < newNode.neighbors.length ; ++j) {
            newNode.neighbors[j].currentNeighbor = true;
        }

        for (i = 0 ; i < nodesInLayout.length ; ++i) {
            nextNode = nodesInLayout[i];
            if (nextNode.currentNeighbor === true) {
                rightNeighborsNumber--;
                leftNeighborsNumber++;
            }
            leftCrossingsNumber += rightNeighborsNumber * nextNode.unplacedNodesNumber;
            rightCrossingsNumber += leftNeighborsNumber * nextNode.unplacedNodesNumber;
        }

        if (leftCrossingsNumber < rightCrossingsNumber) {
            nodesInLayout.unshift(newNode);
        } else {
            nodesInLayout.push(newNode);
        }
    },

    setNodesPositions = function(nodesInLayout) {
        var nodesCount = graph.getNodesCount(),
            angleStep,
            angle = 0,
            i = 0,
            radius = settings.radius,
            center = settings.center;

        if (nodesCount === 0) {
            return;
        }

        angleStep = 2 * Math.PI / nodesCount;

        for (i = 0 ; i < nodesInLayout.length ; ++i) {
            nodesInLayout[i].position = {
                angle : angle,
                x : center.x + radius * Math.sin(angle),
                y : center.y + radius * Math.cos(angle),
                i : i,
            };
            angle += angleStep;
        }
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

    compareInts = function(i1, i2) {
        if(i1 > i2) {
            return 1;
        }
        if(i1 < i2) {
            return -1;
        }
        return 0;
    },

    // get number of edge crossings 
    // between pair of vertices
    getCrossingsNumber = function(i, j, nodesInLayout) {

        var neighbors = [],
            x,
            crossing = 0,
            notCrossing = 0,
            prevIndex = -1,
            zerosNumberCrossing = 0,
            zerosNumberNotCrossing = 0;

        for (x = 0 ; x < nodesInLayout[i].neighbors.length ; ++x) {
            if (nodesInLayout[i].neighbors[x].position.i !== j) {
                neighbors.push({ node : nodesInLayout[i].neighbors[x],
                                 owner: i });
            }
        }

        for (x = 0 ; x < nodesInLayout[j].neighbors.length ; ++x) {
            if (nodesInLayout[j].neighbors[x].position.i !== i) {
                neighbors.push({ node : nodesInLayout[j].neighbors[x],
                                 owner: j });
                zerosNumberNotCrossing++;
            }
        }

        // we need to sort all neighbors from i to j (i + 1)
        // i.e. how far they are from i
        var compare = function(node1, node2) {
            var i1 = node1.node.position.i,
                i2 = node2.node.position.i;
            if (i1 < i) {
                i1 += graph.getNodesCount();
            }
            if (i2 < i) {
                i2 += graph.getNodesCount();
            }
            return compareInts(i2, i1);
        };

        neighbors.sort(compare);

        for (x = 0 ; x < neighbors.length ; ++x) {
            // check if it is the same node
            if (neighbors[x].node.position.i !== prevIndex) {
                prevIndex = neighbors[x].node.position.i;
                if (neighbors[x].owner === i) {
                    crossing += zerosNumberCrossing;
                    notCrossing += zerosNumberNotCrossing;
                }
            } else {
                notCrossing--;
            }
            if (neighbors[x].owner === j) {
                zerosNumberCrossing++;
                zerosNumberNotCrossing--;
            }
        }

        return [crossing, notCrossing];
    },

    // Sift node with initial position i
    // Until found best position that
    // minimize number of crossings
    improvePosition = function(i, nodesInLayout) {

        var node,
            nextIndex,
            swapWithIndex = i,
            crossingsBeforeAndAfterSwap,
            crossings = graph.getLinksCount() * graph.getLinksCount(), // TODO
            // any value will be less then this
            minCrossings = crossings,
            minCrossingsPosition = i;

        for (var j = 0 ; j < (nodesInLayout.length - 1) ; ++j) {
            // determine nodes indexes in array
            nextIndex = swapWithIndex;
            swapWithIndex = (nextIndex !== (nodesInLayout.length - 1) ) ? nextIndex + 1 : 0;
            // get number of crossing edges, which are incedent to these nodes
            crossingsBeforeAndAfterSwap = getCrossingsNumber(nextIndex, swapWithIndex, nodesInLayout);

            // get number of crossing edges after swapping
            crossings = crossings - crossingsBeforeAndAfterSwap[0] + crossingsBeforeAndAfterSwap[1];

            if (crossings < minCrossings) {
                minCrossings = crossings;
                minCrossingsPosition = swapWithIndex;
            }

            // swap nodes
            node = nodesInLayout[nextIndex];
            nodesInLayout[nextIndex] = nodesInLayout[swapWithIndex];
            nodesInLayout[nextIndex].position.i = nextIndex;
            nodesInLayout[swapWithIndex] = node;
            nodesInLayout[swapWithIndex].position.i = swapWithIndex;
        }

        if (i === minCrossingsPosition) {
            return;
        }

        // put node to it's best position, shifting all other nodes
        // after swapping, node will have position i - 1 (not i)
        // and it's optimal position will also be minCrossingsPosition - 1
        minCrossingsPosition = (minCrossingsPosition === 0) ? (nodesInLayout.length - 1) : minCrossingsPosition - 1;
        i = (i === 0) ? (nodesInLayout.length - 1) : i - 1;

        swapWithIndex = i;
        while (swapWithIndex !== minCrossingsPosition) {
            // determine nodes indexes in array
            nextIndex = swapWithIndex;
            swapWithIndex = (nextIndex !== (nodesInLayout.length - 1) ) ? nextIndex + 1 : 0;

            nodesInLayout[nextIndex] = nodesInLayout[swapWithIndex];
            nodesInLayout[swapWithIndex] = node;
        }
    },

    setLayout = function() {
        var nodesInLayout = [],
            unplacedNodes = [],
            pickedNode,
            position,
            i,
            nodesNumber = graph.getNodesCount();

        graph.forEachNode(
            function(node) {
                node.position = {x : settings.center.x, y : settings.center.y};
                unplacedNodes.push(node);
            }
        );

        var pickNode = getPickNodeFunction(unplacedNodes);

        while(nodesInLayout.length !== nodesNumber) {
            pickedNode = pickNode();
            greedyAddNode(nodesInLayout, pickedNode);
        }

        for (i = 0 ; i < nodesInLayout.length ; ++i) {
            nodesInLayout[i].position = {
                i : i,
            };
        }

        // Circular cifting improvement
        for(i = 0, position = 0 ; i < nodesInLayout.length ; ++i) {
            console.log('sifting ' + i);
            while(nodesInLayout[position].sifted === true) {
                if (++position === nodesInLayout.length) {
                    position = 0;
                }
            }
            nodesInLayout[position].sifted = true;
            improvePosition(position, nodesInLayout);
        }

        // Set positions (x, y) according to sequence
        setNodesPositions(nodesInLayout);
    };

    setLayout();

    return {

        step: function() {
            return true;
        },

        // Returns rectangle structure {x1, y1, x2, y2}, which represents
        // current space occupied by graph.
        getGraphRect: function() {
            return graphRect;
        },

        // Request to release all resources
        dispose: function() {
        }
    };
};

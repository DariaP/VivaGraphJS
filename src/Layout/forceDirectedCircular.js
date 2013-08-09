// I don't like to suppress this, but I'm afraid 'force_directed_body'
// could already be used by someone. Don't want to break it now.
/* jshint camelcase:false */
/*jshint unused: false*/

Viva.Graph.Layout = Viva.Graph.Layout || {};
Viva.Graph.Layout.forceDirectedCircular = function(graph, settings) {
    var STABLE_THRESHOLD = 0.001; // Maximum movement of the system which can be considered as stabilized

    if (!graph) {
        throw {
            message: 'Graph structure cannot be undefined'
        };
    }

    settings = Viva.lazyExtend(settings, {
        /**
         * Ideal length for links (springs in physical model).
         */
        springLength: 1,

        /**
         * Hook's law coefficient. 1 - solid spring.
         */
        springCoeff: 0.0002,

        /**
         * Coulomb's law coefficient. It's used to repel nodes thus should be negative
         * if you make it positive nodes start attract each other :).
         */
        gravity: -1.2,

        /**
         * Theta coeffiecient from Barnes Hut simulation. Ranged between (0, 1).
         * The closer it's to 1 the more nodes algorithm will have to go through.
         * Setting it to one makes Barnes Hut simulation no different from
         * brute-force forces calculation (each node is considered).
         */
        theta: 0.8,

        /**
         * Drag force coefficient. Used to slow down system, thus should be less than 1.
         * The closer it is to 0 the less tight system will be.
         */
        dragCoeff: 0.02,

        radius: 100,

        center: {x : 500, y : 500, mass : 1000},

        centerLinkCoeff : 0.0001

    });

    var forceSimulator = Viva.Graph.Physics.forceSimulator(Viva.Graph.Physics.eulerIntegrator()),
        nbodyForce = Viva.Graph.Physics.nbodyForce({
            gravity: settings.gravity,
            theta: settings.theta
        }),
        springForce = Viva.Graph.Physics.springForce({
            length: settings.springLength,
            coeff: settings.springCoeff
        }),
        dragForce = Viva.Graph.Physics.dragForce({
            coeff: settings.dragCoeff
        }),
        graphRect = new Viva.Graph.Rect(),
        random = Viva.random('ted.com', 103, 114, 101, 97, 116),

        getBestNodePosition = function(node) {
            // TODO: Initial position could be picked better, e.g. take into
            // account all neighbouring nodes/links, not only one.
            // TODO: this is the same as in gem layout. consider refactoring.
            var baseX = (graphRect.x1 + graphRect.x2) / 2,
                baseY = (graphRect.y1 + graphRect.y2) / 2,
                springLength = settings.springLength;

            if (node.links && node.links.length > 0) {
                var firstLink = node.links[0],
                    otherNode = firstLink.fromId !== node.id ? graph.getNode(firstLink.fromId) : graph.getNode(firstLink.toId);
                if (otherNode.position) {
                    baseX = otherNode.position.x;
                    baseY = otherNode.position.y;
                }
            }

            return {
                x: baseX + random.next(springLength) - springLength / 2,
                y: baseY + random.next(springLength) - springLength / 2
            };
        },

        updateNodeMass = function(node) {
            var body = node.force_directed_body;
            body.mass = 1 + graph.getLinks(node.id).length / 3.0;
        },

        initNode = function(node) {
            var body = node.force_directed_body;
            if (!body) {
                // TODO: rename position to location or location to position to be consistent with
                // other places.
                node.position = node.position || getBestNodePosition(node);

                body = new Viva.Graph.Physics.Body();
                node.force_directed_body = body;
                updateNodeMass(node);

                body.loc(node.position);
                forceSimulator.addBody(body);
            }
        },

        releaseNode = function(node) {
            var body = node.force_directed_body;
            if (body) {
                node.force_directed_body = null;
                delete node.force_directed_body;

                forceSimulator.removeBody(body);
            }
        },

        initLink = function(link) {
            // TODO: what if bodies are not initialized?
            var from = graph.getNode(link.fromId),
                to = graph.getNode(link.toId);

            updateNodeMass(from);
            updateNodeMass(to);
            link.force_directed_spring = forceSimulator.addSpring(
                from.force_directed_body,
                to.force_directed_body,
                -1, // use default value of length from settings
                -1, // use default value of coeff from settings
                link.weight
            );
        },

        releaseLink = function(link) {
            var spring = link.force_directed_spring;
            if (spring) {
                var from = graph.getNode(link.fromId),
                    to = graph.getNode(link.toId);
                if (from) {
                    updateNodeMass(from);
                }
                if (to) {
                    updateNodeMass(to);
                }

                link.force_directed_spring = null;
                delete link.force_directed_spring;

                forceSimulator.removeSpring(spring);
            }
        },

        onGraphChanged = function(changes) {
            for (var i = 0; i < changes.length; ++i) {
                var change = changes[i];
                if (change.changeType === 'add') {
                    if (change.node) {
                        initNode(change.node);
                    }
                    if (change.link) {
                        initLink(change.link);
                    }
                } else if (change.changeType === 'remove') {
                    if (change.node) {
                        releaseNode(change.node);
                    }
                    if (change.link) {
                        releaseLink(change.link);
                    }
                }
                // Probably we don't need to care about 'update' event here;
            }
        },

        initSimulator = function() {
            graph.forEachNode(initNode);
            graph.forEachLink(initLink);
            graph.addEventListener('changed', onGraphChanged);
        },

        initCircularPart = function() {
            // place all nodes to the center of the circle
            // TODO: if you put this before initSimulator(), page hangs
            graph.forEachNode(function(node) {
                node.position.x = settings.center.x;
                node.position.y = settings.center.y;
            });

            // add center of the circle as static heavy node,
            // but connected to all nodes in graph.
            // center will not move and it will make all
            // nodes in graph stay near the center
            var circleCenter = new Viva.Graph.Physics.Body();
            circleCenter.mass = settings.center.mass;
            circleCenter.loc({x : settings.center.x, y : settings.center.y});
            forceSimulator.addStaticBody(circleCenter);
            graph.forEachNode(function(node) {
                forceSimulator.addSpring(node.force_directed_body, circleCenter, settings.radius, settings.centerLinkCoeff);
            });
        },

        isNodePinned = function(node) {
            if (!node) {
                return true;
            }

            return node.isPinned || (node.data && node.data.isPinned);
        },

        updateNodePositions = function() {
            var x1 = Number.MAX_VALUE,
                y1 = Number.MAX_VALUE,
                x2 = Number.MIN_VALUE,
                y2 = Number.MIN_VALUE;
            if (graph.getNodesCount() === 0) {
                return;
            }

            graph.forEachNode(function(node) {
                var body = node.force_directed_body;
                if (!body) {
                    // This could be a sign someone removed the propery.
                    // I should really decouple force related stuff from node
                    return;
                }

                if (isNodePinned(node)) {
                    body.loc(node.position);
                }

                // TODO: once again: use one name to be consistent (position vs location)
                node.position.x = body.location.x;
                node.position.y = body.location.y;

                if (node.position.x < x1) {
                    x1 = node.position.x;
                }
                if (node.position.x > x2) {
                    x2 = node.position.x;
                }
                if (node.position.y < y1) {
                    y1 = node.position.y;
                }
                if (node.position.y > y2) {
                    y2 = node.position.y;
                }
            });

            graphRect.x1 = x1;
            graphRect.x2 = x2;
            graphRect.y1 = y1;
            graphRect.y2 = y2;
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
            var nodes = [],
                angleStep = 2 * Math.PI / graph.getNodesCount(),
                angle = 0;

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
                nodes[i].position.x = settings.center.x + settings.radius * Math.cos(angle);
                nodes[i].position.y = settings.center.y + settings.radius * Math.sin(angle);
                angle += angleStep;
            }

        };

    forceSimulator.addSpringForce(springForce);
    forceSimulator.addBodyForce(nbodyForce);
    forceSimulator.addBodyForce(dragForce);

    initSimulator();

    initCircularPart();

    return {
        /**
         * Attempts to layout graph within given number of iterations.
         *
         * @param {integer} [iterationsCount] number of algorithm's iterations.
         */
        run: function(iterationsCount) {
            var i;
            iterationsCount = iterationsCount || 50;

            for (i = 0; i < iterationsCount; ++i) {
                this.step();
            }
        },

        step: function() {
            var energy = forceSimulator.run(20);
            updateNodePositions();

            if (energy < STABLE_THRESHOLD) {
                alignNodes();
                return true;
            }
            return false;
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
            graph.removeEventListener('change', onGraphChanged);
        },

        // Layout specific methods
        /**
         * Gets or sets current desired length of the edge.
         *
         * @param length new desired length of the springs (aka edge, aka link).
         * if this parameter is empty then old spring length is returned.
         */
        springLength: function(length) {
            if (arguments.length === 1) {
                springForce.options({
                    length: length
                });
                return this;
            }

            return springForce.options().length;
        },

        /**
         * Gets or sets current spring coeffiсient.
         *
         * @param coeff new spring coeffiсient.
         * if this parameter is empty then its old value returned.
         */
        springCoeff: function(coeff) {
            if (arguments.length === 1) {
                springForce.options({
                    coeff: coeff
                });
                return this;
            }

            return springForce.options().coeff;
        },

        /**
         * Gets or sets current gravity in the nbody simulation.
         *
         * @param g new gravity constant.
         * if this parameter is empty then its old value returned.
         */
        gravity: function(g) {
            if (arguments.length === 1) {
                nbodyForce.options({
                    gravity: g
                });
                return this;
            }

            return nbodyForce.options().gravity;
        },

        /**
         * Gets or sets current theta value in the nbody simulation.
         *
         * @param t new theta coeffiсient.
         * if this parameter is empty then its old value returned.
         */
        theta: function(t) {
            if (arguments.length === 1) {
                nbodyForce.options({
                    theta: t
                });
                return this;
            }

            return nbodyForce.options().theta;
        },

        /**
         * Gets or sets current theta value in the nbody simulation.
         *
         * @param dragCoeff new drag coeffiсient.
         * if this parameter is empty then its old value returned.
         */
        drag: function(dragCoeff) {
            if (arguments.length === 1) {
                dragForce.options({
                    coeff: dragCoeff
                });
                return this;
            }

            return dragForce.options().coeff;
        }
    };
};

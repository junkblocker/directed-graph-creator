document.onload = (function(d3, saveAs, Blob, undefined){
  "use strict";

  // TODO add user settings
  var consts = {
    defaultTitle: "camera-retro",
    // graphClass: "graph",
    arrowWidth: "6px",
    arrowHeight: "6px",
    rectSide: 50
  };
  var settings = {
    appendElSpec: "#graph"
  };
  // define graphcreator object
  var GraphCreator = function(svg, nodes, edges){
    var thisGraph = this;
        thisGraph.idct = 0;
        thisGraph.svg = svg;
        thisGraph.nodes = nodes || [];
        thisGraph.edges = edges || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null
    };

    // define arrow markers for graph links
    thisGraph.initMarkers();
    var svgG = thisGraph.initMainGroup();
    thisGraph.addDragLine(); // displayed when dragging between nodes


    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.u_services = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
          .origin(function(d){
            return {x: d.x, y: d.y};
          })
          .on("drag", function(args){
            thisGraph.state.justDragged = true;
            thisGraph.dragmove.call(thisGraph, args);
          })
          .on("dragend", function() {
            // todo check if edge-mode is selected
          });

    // listen for key events
    d3.select(window).on("keydown", function(){
      thisGraph.svgKeyDown.call(thisGraph);
    })
    .on("keyup", function(){
      thisGraph.svgKeyUp.call(thisGraph);
    });
    svg.on("mousedown", function(d){thisGraph.svgMouseDown.call(thisGraph, d);});
    svg.on("mouseup", function(d){thisGraph.svgMouseUp.call(thisGraph, d);});

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
          .on("zoom", function(){
            if (d3.event.sourceEvent.shiftKey){
              // TODO  the internal d3 state is still changing
              return false;
            } else{
              thisGraph.zoomed.call(thisGraph);
            }
            return true;
          })
          .on("zoomstart", function(){
            var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
            if (ael){
              ael.blur();
            }
            if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
          })
          .on("zoomend", function(){
            d3.select('body').style("cursor", "auto");
          });

    //svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function(){thisGraph.updateWindow(svg);};

    // handle download data
    d3.select("#download-input").on("click", function(){
      var saveEdges = [];
      thisGraph.edges.forEach(function(val, i){
        saveEdges.push({source: val.source.id, target: val.target.id});
      });
      var blob = new Blob([window.JSON.stringify({"nodes": thisGraph.nodes, "edges": saveEdges})], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "mydag.json");
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function(){
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function(){
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function(){
          var txtRes = filereader.result;
          // TODO better error handling
          try{
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function(e, i){
              newEdges[i] = {source: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0],
                          target: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0]};
            });
            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          }catch(err){
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

   /** MENU **/
   var currentActiveMenu;
   var updateMenu = function(link) {
      if (currentActiveMenu) {
         currentActiveMenu.classList.remove("active");
         d3.select("#sm-" + currentActiveMenu.id).node().style.display = 'none';
      }
      currentActiveMenu = link;
      currentActiveMenu.classList.add("active");
      d3.select("#sm-" + currentActiveMenu.id).node().style.display = 'block';
   };

   var loadMenuFromJson = function(menu) {
      var mainMenu = d3.select("#mainmenu > ul");
      var submenus = d3.select("#menu");
      mainMenu.text('');
      submenus.text('');
      menu.menu.forEach(
         function(om) {
            mainMenu.append("li")
               .append("a")
               .attr("id", om.id)
               .classed('mainmenu', true)
               .text(om.label)
               .on("click", function() { updateMenu(this) });
            var sms = submenus.append("ul")
               .attr("id", "sm-" + om.id)
               .classed("menu", true);
            om.menu.forEach(
               function(sm) {
                  var li = sms.append("li")
                     .attr("id", sm.id)
                     .attr("data-icon", sm.icon)
                     .classed("menu", true)
                     .attr("data-props", sm.props);
                  li.append("span")
                     .classed("icon", true)
                     .classed("fa", true)
                     .classed("fa-" + sm.icon, true);
                  li.append("span").text(' ' + sm.label);
               }
            );
         }
      );
      currentActiveMenu = null;
      updateMenu(d3.select("a.mainmenu").node());
      d3.selectAll("li.menu").each(
         function() {
            var id = this.id;
            var icon = this.getAttribute("data-icon");
            d3.select(this).on("click", function() {
               thisGraph.addNode(id, icon);
            });
         }
      );
   };

   function loadMenuFromUri(uri) {
      d3.json(uri, loadMenuFromJson);
   }
   loadMenuFromUri('menu.json');

   d3.select("#upload-menu").on("click", function() {
      document.getElementById("hidden-menu-upload").click();
   });
   d3.select("#hidden-menu-upload").on("change", function() {
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function(){
          var txtRes = filereader.result;
          // TODO better error handling
          try{
            var jsonObj = JSON.parse(txtRes);
          }catch(err){
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
         loadMenuFromJson(jsonObj);
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }
   });

    // handle delete graph
    d3.select("#delete-graph").on("click", function(){
      thisGraph.deleteGraph(false);
    });


      thisGraph.tooltip = d3.select("body")
         .append("div")
         .attr("id", "tooltip")
         .attr("class", "tooltip")          
         .style("opacity", 0);

  };
    
  GraphCreator.prototype.setIdCt = function(idct){
    this.idct = idct;
  };

  GraphCreator.prototype.consts =  {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50,
    rectSide: 50
  };

  /* PROTOTYPE FUNCTIONS */
  GraphCreator.prototype.initMarkers = function() {
      var defs = this.svg.append('svg:defs');
      defs.append('svg:marker')
         .attr('id', 'end-arrow')
         .attr('viewBox', '0 -5 10 10')
         .attr('refX', "0")
         .attr('markerWidth', consts.arrowWidth)
         .attr('markerHeight', consts.arrowHeight)
         .attr('orient', 'auto')
         .append('svg:path')
         .attr('d', 'M0,-5L10,0L0,5');

      // define arrow markers for leading arrow
      defs.append('svg:marker')
         .attr('id', 'mark-end-arrow')
         .attr('viewBox', '0 -5 10 10')
         .attr('refX', 7)
         .attr('markerWidth', consts.arrowWidth)
         .attr('markerHeight', consts.arrowHeight)
         .attr('orient', 'auto')
         .append('svg:path')
         .attr('d', 'M0,-5L10,0L0,5');
  };

  GraphCreator.prototype.initMainGroup = function() {
    this.svgG = svg.append("g")
          .classed(this.consts.graphClass, true);
    return this.svgG;
  };
  
  GraphCreator.prototype.addDragLine = function() {
    this.dragLine = this.svgG.append('svg:path')
          .attr('class', 'link dragline hidden')
          .attr('d', 'M0,0L0,0')
          .style('marker-end', 'url(#mark-end-arrow)');
  };

  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag){
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else{
      d.x += d3.event.dx;
      d.y +=  d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function(skipPrompt){
    var thisGraph = this,
        doDelete = true;
    if (!skipPrompt){
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if(doDelete){
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitle = function (gEl, title) {
    var icon = GraphCreator.FONT_AWESOME[title];
    var el = gEl.append("text")
          .attr("text-anchor","middle")
          .attr('font-family', 'FontAwesome')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '20px')
          .text(icon);
  };

   GraphCreator.prototype.insertProperties = function(gEl, node) {
      var thisGraph = this;
      var div = thisGraph.tooltip;
      var pEl = gEl.append("rect")
         .classed("props", true)
         .attr("x", consts.rectSide / 2  - 5)
         .attr("y", -consts.rectSide / 2 + 5)
         .attr("width", 8)
         .attr("height", 8);
      pEl.on("mouseover", function() {    
            div.transition()     
                .duration(200)      
                .style("opacity", .9)
                .style("left", (d3.event.pageX + 10) + "px")     
                .style("top", (d3.event.pageY - 28) + "px");   
            div.html(node.props);
            })             
        .on("mouseout", function() {     
            div.transition()     
                .duration(500)      
                .style("opacity", 0);  
        })
         .on("click", function() {
            div.style("opacity", 0);
            var d3txt = thisGraph.changeTextOfNode(d3.select('#tooltip'), node);
            var txtNode = d3txt.node();
            thisGraph.selectElementContents(txtNode);
            txtNode.focus();
         })
         ;
   };

  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function(node) {
    var thisGraph = this,
        toSplice = thisGraph.edges.filter(function(l) {
      return (l.source === node || l.target === node);
    });
    toSplice.map(function(l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function(d3Path, edgeData){
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    if (thisGraph.state.selectedEdge){
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function(d3Node, nodeData){
    var thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode){
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;
  };

  GraphCreator.prototype.removeSelectFromNode = function(){
    var thisGraph = this;
    thisGraph.u_services.filter(function(cd){
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;
  };

  GraphCreator.prototype.removeSelectFromEdge = function(){
    var thisGraph = this;
    thisGraph.paths.filter(function(cd){
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function(d3path, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;

    if (state.selectedNode){
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d){
      thisGraph.replaceSelectEdge(d3path, d);
    } else{
      thisGraph.removeSelectFromEdge();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;
    if (d3.event.shiftKey){
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
  };

  /* place editable text on node in place of svg text */
  GraphCreator.prototype.changeTextOfNode = function(d3node, d){
    var thisGraph= this,
        consts = thisGraph.consts,
        htmlEl = d3node.node();
    d3node.selectAll("text").remove();

    var etext = d.props.replace(/<br *\/?>/g, "\n");

    var nodeBCR = htmlEl.getBoundingClientRect(),
        curScale = nodeBCR.width/consts.nodeRadius,
        placePad  =  5*curScale,
        useHW = curScale > 1 ? nodeBCR.width*0.71 : consts.nodeRadius*1.42;
    // replace with editableconent text
    var d3txt = thisGraph.svg.selectAll("foreignObject")
          .data([d])
          .enter()
          .append("foreignObject")
          .attr("x", nodeBCR.left + placePad )
          .attr("y", nodeBCR.top + placePad)
          .attr("height", 400)
          .attr("width", 200)
          .append("xhtml:textarea")
          .attr("id", consts.activeEditId)
          //.attr("contentEditable", "true")
          .text(etext)
          .on("mousedown", function(d){
            d3.event.stopPropagation();
          })
          .on("keydown", function(d){
            d3.event.stopPropagation();
          })
          .on("blur", function(d){
            d.props = this.value.replace(/\n/g, "<br/>");
            d3.select(this.parentElement).remove();
            d3node.editing = false;
          });
    return d3txt;
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d){
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {source: mouseDownNode, target: d};
      var filtRes = thisGraph.paths.filter(function(d){
        if (d.source === newEdge.target && d.target === newEdge.source){
          thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
        }
        return d.source === newEdge.source && d.target === newEdge.target;
      });
      if (!filtRes[0].length){
        thisGraph.edges.push(newEdge);
        thisGraph.updateGraph();
      }
    } else{
      // we're in the same node
      if (state.justDragged) {
        // dragged, not clicked
        state.justDragged = false;
      } else{
        // clicked, not dragged
        if (d3.event.shiftKey){
//          // shift-clicked node: edit text content
//          var d3txt = thisGraph.changeTextOfNode(d3node, d);
//          var txtNode = d3txt.node();
//          thisGraph.selectElementContents(txtNode);
//          txtNode.focus();

         }
         else if (d3.event.altKey) {
            var div = thisGraph.tooltip;
            div.style("opacity", 0);
            div.editing = true;
            var d3txt = thisGraph.changeTextOfNode(div, d);
            var txtNode = d3txt.node();
            thisGraph.selectElementContents(txtNode);
            txtNode.focus();
        } else{
          if (state.selectedEdge){
            thisGraph.removeSelectFromEdge();
          }
          var prevNode = state.selectedNode;

          if (!prevNode || prevNode.id !== d.id){
            thisGraph.replaceSelectNode(d3node, d);
          } else{
            thisGraph.removeSelectFromNode();
          }
        }
      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of u_services mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function(){
    this.state.graphMouseDown = true;
  };

   GraphCreator.prototype.addNode = function(id, icon) {
      var thisGraph = this;
      var origin = d3.select('#' + id)[0][0];
      var d = {id: thisGraph.idct++, title: icon, x: 250, y: 150, props: origin.getAttribute('data-props')};
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
      // make title of text immediently editable
//      var d3txt = thisGraph.changeTextOfNode(thisGraph.u_services.filter(function(dval){
//        return dval.id === d.id;
//      }), d),
//          txtNode = d3txt.node();
//      thisGraph.selectElementContents(txtNode);
//      txtNode.focus();
   };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function(){
    var thisGraph = this,
        state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.shiftNodeDrag){
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function() {
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if(state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
        selectedEdge = state.selectedEdge;

    switch(d3.event.keyCode) {
    case consts.BACKSPACE_KEY:
    case consts.DELETE_KEY:
      d3.event.preventDefault();
      if (selectedNode){
        thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
        thisGraph.spliceLinksForNode(selectedNode);
        state.selectedNode = null;
        thisGraph.updateGraph();
      } else if (selectedEdge){
        thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
        state.selectedEdge = null;
        thisGraph.updateGraph();
      }
      d3.event.stopPropagation();
      break;
    }
  };

  GraphCreator.prototype.svgKeyUp = function() {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function(){

    var thisGraph = this,
        consts = thisGraph.consts,
        state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function(d){
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var paths = thisGraph.paths;
    // update existing paths
    paths.style('marker-mid', 'url(#end-arrow)')
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      .attr("d", function(d){
        var ix = (d.source.x + d.target.x) / 2;
        var iy = (d.source.y + d.target.y) / 2;
        return "M" + d.source.x + "," + d.source.y
             + "L" + ix         + "," + iy
             + "L" + d.target.x + "," + d.target.y;
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-mid','url(#end-arrow)')
      .classed("link", true)
      .attr("d", function(d){
        var ix = (d.source.x + d.target.x) / 2;
        var iy = (d.source.y + d.target.y) / 2;
        return "M" + d.source.x + "," + d.source.y
             + "L" + ix         + "," + iy
             + "L" + d.target.x + "," + d.target.y;
      })
      .on("mousedown", function(d){
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
        }
      )
      .on("mouseup", function(d){
        state.mouseDownLink = null;
        if (d3.event.altKey) {
            var div = thisGraph.tooltip;
            div.style("opacity", 0);
            div.editing = true;
            var d3txt = thisGraph.changeTextOfNode(div, d);
            var txtNode = d3txt.node();
            thisGraph.selectElementContents(txtNode);
            txtNode.focus();
        }
      })
      .on("mouseover", function(d){
         if (! d.props) {
            d.props = "some property";
         }
         thisGraph.tooltip.transition()     
               .duration(200)      
               .style("opacity", .9)
               .style("left", (d3.event.pageX + 10) + "px")     
               .style("top", (d3.event.pageY - 28) + "px");   
         thisGraph.tooltip.html(d.props);
      })
      .on("mouseout", function(d){
         thisGraph.tooltip.transition()     
               .duration(500)      
               .style("opacity", 0);  
      });

    // remove old links
    paths.exit().remove();

    // update existing nodes
    thisGraph.u_services = thisGraph.u_services.data(thisGraph.nodes, function(d){ return d.id;});
    thisGraph.u_services.attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";});

    // add new nodes
    var newGs= thisGraph.u_services.enter()
          .append("g");

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";})
      .on("mouseover", function(d){
        if (state.shiftNodeDrag){
          d3.select(this).classed(consts.connectClass, true);
        }
        var div = thisGraph.tooltip;
        if (! div.editing) {
            div.transition()     
                .duration(200)      
                .style("opacity", .9)
                .style("left", (d3.event.pageX + 10) + "px")     
                .style("top", (d3.event.pageY - 28) + "px");   
            div.html(d.props);
        }
      })
      .on("mouseout", function(d){
         d3.select(this).classed(consts.connectClass, false);
         thisGraph.tooltip.transition()     
            .duration(500)      
            .style("opacity", 0);  
      })
      .on("mousedown", function(d){
         thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
         thisGraph.tooltip.transition()     
            .duration(500)      
            .style("opacity", 0);  
      })
      .on("mouseup", function(d){
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
        var div = thisGraph.tooltip;
        if (false && ! div.editing) {
            div.transition()     
                .duration(200)      
                .style("opacity", .9)
                .style("left", (d3.event.pageX + 10) + "px")     
                .style("top", (d3.event.pageY - 28) + "px");   
            div.html(d.props);
        }
      })
      .call(thisGraph.drag);

   newGs.append("rect")
      .classed("node", true)
      .attr("x", -consts.rectSide / 2)
      .attr("y", -consts.rectSide / 2)
      .attr("width", consts.rectSide)
      .attr("height", consts.rectSide)
      .attr("transform", function(d, i) { return "scale(" + (1 - d / consts.rectSide) * 20 + ")"; });


    newGs.each(function(d){
      thisGraph.insertTitle(d3.select(this), d.title);
      // thisGraph.insertProperties(d3.select(this), d);
    });

    // remove old nodes
    thisGraph.u_services.exit().remove();
  };

  GraphCreator.prototype.zoomed = function(){
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ")"); // scale(" + d3.event.scale + ")");
  };

  GraphCreator.prototype.updateWindow = function(svg){
    var docEl = document.documentElement,
        bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };

   GraphCreator.FONT_AWESOME = {
      "adjust" : "\uf042",
      "adn" : "\uf170",
      "align-center" : "\uf037",
      "align-justify" : "\uf039",
      "align-left" : "\uf036",
      "align-right" : "\uf038",
      "ambulance" : "\uf0f9",
      "anchor" : "\uf13d",
      "android" : "\uf17b",
      "angellist" : "\uf209",
      "angle-double-down" : "\uf103",
      "angle-double-left" : "\uf100",
      "angle-double-right" : "\uf101",
      "angle-double-up" : "\uf102",
      "angle-down" : "\uf107",
      "angle-left" : "\uf104",
      "angle-right" : "\uf105",
      "angle-up" : "\uf106",
      "apple" : "\uf179",
      "archive" : "\uf187",
      "area-chart" : "\uf1fe",
      "arrow-circle-down" : "\uf0ab",
      "arrow-circle-left" : "\uf0a8",
      "arrow-circle-o-down" : "\uf01a",
      "arrow-circle-o-left" : "\uf190",
      "arrow-circle-o-right" : "\uf18e",
      "arrow-circle-o-up" : "\uf01b",
      "arrow-circle-right" : "\uf0a9",
      "arrow-circle-up" : "\uf0aa",
      "arrow-down" : "\uf063",
      "arrow-left" : "\uf060",
      "arrow-right" : "\uf061",
      "arrow-up" : "\uf062",
      "arrows" : "\uf047",
      "arrows-alt" : "\uf0b2",
      "arrows-h" : "\uf07e",
      "arrows-v" : "\uf07d",
      "asterisk" : "\uf069",
      "at" : "\uf1fa",
      "audio-description": "\uf29e",
      "backward" : "\uf04a",
      "ban" : "\uf05e",
      "bar-chart" : "\uf080",
      "barcode" : "\uf02a",
      "bars" : "\uf0c9",
      "beer" : "\uf0fc",
      "behance" : "\uf1b4",
      "behance-square" : "\uf1b5",
      "bell" : "\uf0f3",
      "bell-o" : "\uf0a2",
      "bell-slash" : "\uf1f6",
      "bell-slash-o" : "\uf1f7",
      "bicycle" : "\uf206",
      "binoculars" : "\uf1e5",
      "birthday-cake" : "\uf1fd",
      "bitbucket" : "\uf171",
      "bitbucket-square" : "\uf172",
      "bold" : "\uf032",
      "bolt" : "\uf0e7",
      "bomb" : "\uf1e2",
      "book" : "\uf02d",
      "bookmark" : "\uf02e",
      "bookmark-o" : "\uf097",
      "briefcase" : "\uf0b1",
      "btc" : "\uf15a",
      "bug" : "\uf188",
      "building" : "\uf1ad",
      "building-o" : "\uf0f7",
      "bullhorn" : "\uf0a1",
      "bullseye" : "\uf140",
      "bus" : "\uf207",
      "calculator" : "\uf1ec",
      "calendar" : "\uf073",
      "calendar-o" : "\uf133",
      "camera" : "\uf030",
      "camera-retro" : "\uf083",
      "car" : "\uf1b9",
      "caret-down" : "\uf0d7",
      "caret-left" : "\uf0d9",
      "caret-right" : "\uf0da",
      "caret-square-o-down" : "\uf150",
      "caret-square-o-left" : "\uf191",
      "caret-square-o-right" : "\uf152",
      "caret-square-o-up" : "\uf151",
      "caret-up" : "\uf0d8",
      "cc" : "\uf20a",
      "cc-amex" : "\uf1f3",
      "cc-discover" : "\uf1f2",
      "cc-mastercard" : "\uf1f1",
      "cc-paypal" : "\uf1f4",
      "cc-stripe" : "\uf1f5",
      "cc-visa" : "\uf1f0",
      "certificate" : "\uf0a3",
      "chain-broken" : "\uf127",
      "check" : "\uf00c",
      "check-circle" : "\uf058",
      "check-circle-o" : "\uf05d",
      "check-square" : "\uf14a",
      "check-square-o" : "\uf046",
      "chevron-circle-down" : "\uf13a",
      "chevron-circle-left" : "\uf137",
      "chevron-circle-right" : "\uf138",
      "chevron-circle-up" : "\uf139",
      "chevron-down" : "\uf078",
      "chevron-left" : "\uf053",
      "chevron-right" : "\uf054",
      "chevron-up" : "\uf077",
      "child" : "\uf1ae",
      "circle" : "\uf111",
      "circle-o" : "\uf10c",
      "circle-o-notch" : "\uf1ce",
      "circle-thin" : "\uf1db",
      "clipboard" : "\uf0ea",
      "clock-o" : "\uf017",
      "clone": "\uf24d",
      "cloud" : "\uf0c2",
      "cloud-download" : "\uf0ed",
      "cloud-upload" : "\uf0ee",
      "code" : "\uf121",
      "code-fork" : "\uf126",
      "codepen" : "\uf1cb",
      "coffee" : "\uf0f4",
      "cog" : "\uf013",
      "cogs" : "\uf085",
      "columns" : "\uf0db",
      "comment" : "\uf075",
      "comment-o" : "\uf0e5",
      "comments" : "\uf086",
      "comments-o" : "\uf0e6",
      "compass" : "\uf14e",
      "compress" : "\uf066",
      "copyright" : "\uf1f9",
      "credit-card" : "\uf09d",
      "crop" : "\uf125",
      "crosshairs" : "\uf05b",
      "css3" : "\uf13c",
      "cube" : "\uf1b2",
      "cubes" : "\uf1b3",
      "cutlery" : "\uf0f5",
      "dashboard" : "\uf0e4",
      "database" : "\uf1c0",
      "delicious" : "\uf1a5",
      "desktop" : "\uf108",
      "deviantart" : "\uf1bd",
      "digg" : "\uf1a6",
      "dot-circle-o" : "\uf192",
      "download" : "\uf019",
      "dribbble" : "\uf17d",
      "dropbox" : "\uf16b",
      "drupal" : "\uf1a9",
      "edit": "\uf044",
      "eject" : "\uf052",
      "ellipsis-h" : "\uf141",
      "ellipsis-v" : "\uf142",
      "empire" : "\uf1d1",
      "envelope" : "\uf0e0",
      "envelope-o" : "\uf003",
      "envelope-square" : "\uf199",
      "eraser" : "\uf12d",
      "eur" : "\uf153",
      "exchange" : "\uf0ec",
      "exclamation" : "\uf12a",
      "exclamation-circle" : "\uf06a",
      "exclamation-triangle" : "\uf071",
      "expand" : "\uf065",
      "external-link" : "\uf08e",
      "external-link-square" : "\uf14c",
      "eye" : "\uf06e",
      "eye-slash" : "\uf070",
      "eyedropper" : "\uf1fb",
      "facebook" : "\uf09a",
      "facebook-square" : "\uf082",
      "fast-backward" : "\uf049",
      "fast-forward" : "\uf050",
      "fax" : "\uf1ac",
      "female" : "\uf182",
      "fighter-jet" : "\uf0fb",
      "file" : "\uf15b",
      "file-archive-o" : "\uf1c6",
      "file-audio-o" : "\uf1c7",
      "file-code-o" : "\uf1c9",
      "file-excel-o" : "\uf1c3",
      "file-image-o" : "\uf1c5",
      "file-o" : "\uf016",
      "file-pdf-o" : "\uf1c1",
      "file-powerpoint-o" : "\uf1c4",
      "file-text" : "\uf15c",
      "file-text-o" : "\uf0f6",
      "file-video-o" : "\uf1c8",
      "file-word-o" : "\uf1c2",
      "files-o" : "\uf0c5",
      "film" : "\uf008",
      "filter" : "\uf0b0",
      "fire" : "\uf06d",
      "fire-extinguisher" : "\uf134",
      "flag" : "\uf024",
      "flag-checkered" : "\uf11e",
      "flag-o" : "\uf11d",
      "flask" : "\uf0c3",
      "flickr" : "\uf16e",
      "floppy-o" : "\uf0c7",
      "folder" : "\uf07b",
      "folder-o" : "\uf114",
      "folder-open" : "\uf07c",
      "folder-open-o" : "\uf115",
      "font" : "\uf031",
      "forward" : "\uf04e",
      "foursquare" : "\uf180",
      "frown-o" : "\uf119",
      "futbol-o" : "\uf1e3",
      "gamepad" : "\uf11b",
      "gavel" : "\uf0e3",
      "gbp" : "\uf154",
      "gift" : "\uf06b",
      "git" : "\uf1d3",
      "git-square" : "\uf1d2",
      "github" : "\uf09b",
      "github-alt" : "\uf113",
      "github-square" : "\uf092",
      "gittip" : "\uf184",
      "glass" : "\uf000",
      "globe" : "\uf0ac",
      "google" : "\uf1a0",
      "google-plus" : "\uf0d5",
      "google-plus-square" : "\uf0d4",
      "google-wallet" : "\uf1ee",
      "graduation-cap" : "\uf19d",
      "group" : "\uf0c0",
      "h-square" : "\uf0fd",
      "hacker-news" : "\uf1d4",
      "hand-o-down" : "\uf0a7",
      "hand-o-left" : "\uf0a5",
      "hand-o-right" : "\uf0a4",
      "hand-o-up" : "\uf0a6",
      "hdd-o" : "\uf0a0",
      "header" : "\uf1dc",
      "headphones" : "\uf025",
      "heart" : "\uf004",
      "heart-o" : "\uf08a",
      "history" : "\uf1da",
      "home" : "\uf015",
      "hospital-o" : "\uf0f8",
      "html5" : "\uf13b",
      "ils" : "\uf20b",
      "image" : "\uf03e",
      "inbox" : "\uf01c",
      "indent" : "\uf03c",
      "info" : "\uf129",
      "info-circle" : "\uf05a",
      "inr" : "\uf156",
      "instagram" : "\uf16d",
      "ioxhost" : "\uf208",
      "italic" : "\uf033",
      "joomla" : "\uf1aa",
      "jpy" : "\uf157",
      "jsfiddle" : "\uf1cc",
      "key" : "\uf084",
      "keyboard-o" : "\uf11c",
      "krw" : "\uf159",
      "language" : "\uf1ab",
      "laptop" : "\uf109",
      "lastfm" : "\uf202",
      "lastfm-square" : "\uf203",
      "leaf" : "\uf06c",
      "lemon-o" : "\uf094",
      "level-down" : "\uf149",
      "level-up" : "\uf148",
      "life-ring" : "\uf1cd",
      "lightbulb-o" : "\uf0eb",
      "line-chart" : "\uf201",
      "link" : "\uf0c1",
      "linkedin" : "\uf0e1",
      "linkedin-square" : "\uf08c",
      "linux" : "\uf17c",
      "list" : "\uf03a",
      "list-alt" : "\uf022",
      "list-ol" : "\uf0cb",
      "list-ul" : "\uf0ca",
      "location-arrow" : "\uf124",
      "lock" : "\uf023",
      "long-arrow-down" : "\uf175",
      "long-arrow-left" : "\uf177",
      "long-arrow-right" : "\uf178",
      "long-arrow-up" : "\uf176",
      "magic" : "\uf0d0",
      "magnet" : "\uf076",
      "male" : "\uf183",
      "map-marker" : "\uf041",
      "map-signs": "\uf277",
      "maxcdn" : "\uf136",
      "meanpath" : "\uf20c",
      "medkit" : "\uf0fa",
      "meh-o" : "\uf11a",
      "microphone" : "\uf130",
      "microphone-slash" : "\uf131",
      "minus" : "\uf068",
      "minus-circle" : "\uf056",
      "minus-square" : "\uf146",
      "minus-square-o" : "\uf147",
      "mobile" : "\uf10b",
      "money" : "\uf0d6",
      "moon-o" : "\uf186",
      "music" : "\uf001",
      "newspaper-o" : "\uf1ea",
      "object-group": "\uf247",
      "openid" : "\uf19b",
      "outdent" : "\uf03b",
      "pagelines" : "\uf18c",
      "paint-brush" : "\uf1fc",
      "paper-plane" : "\uf1d8",
      "paper-plane-o" : "\uf1d9",
      "paperclip" : "\uf0c6",
      "paragraph" : "\uf1dd",
      "pause" : "\uf04c",
      "paw" : "\uf1b0",
      "paypal" : "\uf1ed",
      "pencil" : "\uf040",
      "pencil-square" : "\uf14b",
      "pencil-square-o" : "\uf044",
      "phone" : "\uf095",
      "phone-square" : "\uf098",
      "picture-o" : "\uf03e",
      "pie-chart" : "\uf200",
      "pied-piper" : "\uf1a7",
      "pied-piper-alt" : "\uf1a8",
      "pinterest" : "\uf0d2",
      "pinterest-square" : "\uf0d3",
      "plane" : "\uf072",
      "play" : "\uf04b",
      "play-circle" : "\uf144",
      "play-circle-o" : "\uf01d",
      "plug" : "\uf1e6",
      "plus" : "\uf067",
      "plus-circle" : "\uf055",
      "plus-square" : "\uf0fe",
      "plus-square-o" : "\uf196",
      "power-off" : "\uf011",
      "print" : "\uf02f",
      "puzzle-piece" : "\uf12e",
      "qq" : "\uf1d6",
      "qrcode" : "\uf029",
      "question" :"f128",
      "question-circle" : "\uf059",
      "quote-left" : "\uf10d",
      "quote-right" : "\uf10e",
      "random" : "\uf074",
      "rebel" : "\uf1d0",
      "recycle" : "\uf1b8",
      "reddit" : "\uf1a1",
      "reddit-square" : "\uf1a2",
      "refresh" : "\uf021",
      "renren" : "\uf18b",
      "repeat" : "\uf01e",
      "reply" : "\uf112",
      "reply-all" : "\uf122",
      "retweet" : "\uf079",
      "road" : "\uf018",
      "rocket" : "\uf135",
      "rss" : "\uf09e",
      "rss-square" : "\uf143",
      "rub" : "\uf158",
      "scissors" : "\uf0c4",
      "search" : "\uf002",
      "search-minus" : "\uf010",
      "search-plus" : "\uf00e",
      "share" : "\uf064",
      "share-alt" : "\uf1e0",
      "share-alt-square" : "\uf1e1",
      "share-square" : "\uf14d",
      "share-square-o" : "\uf045",
      "shield" : "\uf132",
      "shopping-bag" : "\uf290",
      "shopping-cart" : "\uf07a",
      "sign-in" : "\uf090",
      "sign-out" : "\uf08b",
      "signal" : "\uf012",
      "sitemap" : "\uf0e8",
      "skype" : "\uf17e",
      "slack" : "\uf198",
      "sliders" : "\uf1de",
      "slideshare" : "\uf1e7",
      "smile-o" : "\uf118",
      "sort" : "\uf0dc",
      "sort-alpha-asc" : "\uf15d",
      "sort-alpha-desc" : "\uf15e",
      "sort-amount-asc" : "\uf160",
      "sort-amount-desc" : "\uf161",
      "sort-asc" : "\uf0de",
      "sort-desc" : "\uf0dd",
      "sort-numeric-asc" : "\uf162",
      "sort-numeric-desc" : "\uf163",
      "soundcloud" : "\uf1be",
      "space-shuttle" : "\uf197",
      "spinner" : "\uf110",
      "spoon" : "\uf1b1",
      "spotify" : "\uf1bc",
      "square" : "\uf0c8",
      "square-o" : "\uf096",
      "stack-exchange" : "\uf18d",
      "stack-overflow" : "\uf16c",
      "star" : "\uf005",
      "star-half" : "\uf089",
      "star-half-o" : "\uf123",
      "star-o" : "\uf006",
      "steam" : "\uf1b6",
      "steam-square" : "\uf1b7",
      "step-backward" : "\uf048",
      "step-forward" : "\uf051",
      "stethoscope" : "\uf0f1",
      "stop" : "\uf04d",
      "strikethrough" : "\uf0cc",
      "stumbleupon" : "\uf1a4",
      "stumbleupon-circle" : "\uf1a3",
      "subscript" : "\uf12c",
      "suitcase" : "\uf0f2",
      "sun-o" : "\uf185",
      "superscript" : "\uf12b",
      "table" : "\uf0ce",
      "tablet" : "\uf10a",
      "tachometer" : "\uf0e4",
      "tag" : "\uf02b",
      "tags" : "\uf02c",
      "tasks" : "\uf0ae",
      "taxi" :"f1ba",
      "tencent-weibo" : "\uf1d5",
      "terminal" : "\uf120",
      "text-height" : "\uf034",
      "text-width" : "\uf035",
      "th" : "\uf00a",
      "th-large" : "\uf009",
      "th-list" : "\uf00b",
      "thumb-tack" : "\uf08d",
      "thumbs-down" : "\uf165",
      "thumbs-o-down" : "\uf088",
      "thumbs-o-up" : "\uf087",
      "thumbs-up" : "\uf164",
      "ticket" : "\uf145",
      "times" : "\uf00d",
      "times-circle" : "\uf057",
      "times-circle-o" : "\uf05c",
      "tint" : "\uf043",
      "toggle-off" : "\uf204",
      "toggle-on" : "\uf205",
      "transcode" : "\uf074",
      "trash" : "\uf1f8",
      "trash-o" : "\uf014",
      "tree" : "\uf1bb",
      "trello" : "\uf181",
      "trophy" : "\uf091",
      "truck" : "\uf0d1",
      "try" : "\uf195",
      "tty" : "\uf1e4",
      "tumblr" : "\uf173",
      "tumblr-square" : "\uf174",
      "tv": "\uf26c",
      "twitch" : "\uf1e8",
      "twitter" : "\uf099",
      "twitter-square" : "\uf081",
      "umbrella" : "\uf0e9",
      "underline" : "\uf0cd",
      "undo" : "\uf0e2",
      "university" : "\uf19c",
      "unlock" : "\uf09c",
      "unlock-alt" : "\uf13e",
      "upload" : "\uf093",
      "usd" : "\uf155",
      "user" : "\uf007",
      "user-md" : "\uf0f0",
      "users" : "\uf0c0",
      "video" : "\uf03d",
      "video-camera" : "\uf03d",
      "vimeo-square" : "\uf194",
      "vine" : "\uf1ca",
      "vk" : "\uf189",
      "volume-down" : "\uf027",
      "volume-off" : "\uf026",
      "volume-up" : "\uf028",
      "weibo" : "\uf18a",
      "weixin" : "\uf1d7",
      "wheelchair" : "\uf193",
      "wifi" : "\uf1eb",
      "windows" : "\uf17a",
      "wordpress" : "\uf19a",
      "wrench" : "\uf0ad",
      "xing" : "\uf168",
      "xing-square" : "\uf169",
      "yahoo" : "\uf19e",
      "yelp" : "\uf1e9",
      "youtube" : "\uf167",
      "youtube-play" : "\uf16a",
      "youtube-square" : "\uf166",
   };



  /**** MAIN ****/

  // warn the user when leaving
//  window.onbeforeunload = function(){
//    return "Make sure to save your graph locally before leaving :-)";
//  };

  var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];

  var width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth,
      height =  window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;

  var xLoc = width/2 - 25,
      yLoc = 100;

  // initial node data
  var nodes = [];
  var edges = [];


  /** MAIN SVG **/
  var svg = d3.select(settings.appendElSpec).append("svg")
        .attr("width", width)
        .attr("height", height);
  var graph = new GraphCreator(svg, nodes, edges);
      graph.setIdCt(2);
  graph.updateGraph();

})(window.d3, window.saveAs, window.Blob);

//Copyright (C) 2016 Aidan Shafran
//
//Permission is hereby granted, free of charge, to any person obtaining a copy
//of this software and associated documentation files (the "Software"), to deal
//in the Software without restriction, including without limitation the rights
//to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//copies of the Software, and to permit persons to whom the Software is
//furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in
//all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//THE SOFTWARE.

// TODO: Linking creates mouse-following arrow

function GraphSVG(RootDivID)
{
	var self = this;

	// Create SVG inside RootDiv
	var SvgContainer = new DraggableSVG();
	d3.select("#" + RootDivID).append(function() { return SvgContainer.Svg.node(); });
	this.SvgRoot = SvgContainer.Svg;
	this.Svg = SvgContainer.Body;
	
	// Initialize d3cola and the SVG
	var Cola = cola.d3adaptor().avoidOverlaps(true).flowLayout("y", 60).handleDisconnected(false);
	this.Svg.append('svg:defs') // Define arrow markers for graph links
			  .append('svg:marker')
			   .attr('id', 'end-arrow')
			   .attr('viewBox', '0 -5 10 10')
			   .attr('refX', 8)
			   .attr('markerWidth', 6)
			   .attr('markerHeight', 6)
			   .attr('orient', 'auto')
			   .append('svg:path')
			    .attr('d', 'M0,-5L10,0L0,5')
					.attr('fill', '#000');
	
	// Consts
	this.MAX_CPT_ENTRIES_BEFORE_MANUAL_DEGENERACY_DECTION = 30000;
	var DEFAULT_NODE_RADIUS = 12;
	var DEFAULT_SELECTION_COLOR = "#ff7f7f";
	
	// Vars
	var SelectedNode = null;
	var Linking = true;
	var LinkingArrow = null;
	var ShowCPTs = false;
	var Init
	var SelectionColor = DEFAULT_SELECTION_COLOR;
	var Spacing = 12;
	this.Nodes = [];
	this.AllowCycles = false;
	this.MaxInNodes = 5;
	this.Modifiable = true;
	
	// Callbacks
	var UpdateGUICallbacks = [];
	var UpdateGraphCallbacks = [];
	
	this.AddOnUpdateGUICallback = function(name, func) {
		for(var i=0;i<UpdateGUICallbacks.length;++i)
			if(UpdateGUICallbacks[i].name == name)
				UpdateGUICallbacks.splice(i, 1);
		if(func)
			UpdateGUICallbacks.push({name: name, func: func});
	}
	this.AddOnUpdateGraphCallback = function(name, func) {
		for(var i=0;i<UpdateGraphCallbacks.length;++i)
			if(UpdateGUICallbacks[i].name == name)
				UpdateGraphCallbacks.splice(i, 1);
		if(func)
			UpdateGraphCallbacks.push({name: name, func: func});
	}
	
	// Getters
	this.GetSelectedNode = function() { return SelectedNode; }
	this.GetIsLinking = function() { return Linking; }
	this.SetShowCPTs = function(Show)	{ ShowCPTs = Show; this.UpdateNodeCPTs(); this.SetSpacing(this.GetSpacing()); }
	this.GetShowCPTs = function() { return ShowCPTs; }
	this.SetSelectionColor = function(color) { SelectionColor = (color == null ? DEFAULT_SELECTION_COLOR : color) ; UpdateGUI(); }
	this.SetSpacing = function(s) { Spacing = s; Cola.symmetricDiffLinkLengths(s * (ShowCPTs ? 1.5 : 1)); Cola.start(); UpdateGUI(); }
	this.GetSpacing = function() { return Spacing; }
	
	Cola.symmetricDiffLinkLengths(Spacing);
	
	// Selects SelectedNode and unselects all other nodes. Specify null to unselect everything
	this.SelectNode = function(Node)
	{
		SelectedNode = Node;
		UpdateGUI();
	}

	// Affixes a node so that it does not move (unless manually dragged)
	// Specify Affix to set if affixed or not, or don't specify to toggle affixed
	this.AffixNode = function(Node, Affix)
	{
		if(!Node)
			return;

		if(typeof(Affix) === 'undefined')
			Node.fixed = Node.fixed ^ 1<<0;
		else
			Node.fixed = Node.fixed ^ ((-(Affix==true) ^ Node.fixed) & (1 << 0));
		Cola.start();
		
		UpdateGUI();
	}
	
	this.LinkNodes = function(SourceNode, TargetNode)
	{
		var Success = SourceNode.LinkTo(TargetNode, this.AllowCycles, this.MaxInNodes);
		switch(Success)
		{
			case "cycles not allowed":
				ShowMessageBox("Cannot create link because it will make a cycle.");
				return false;
			case "too many parents":
				ShowMessageBox("Cannot create link because it will give the target node too many in-nodes.");
				return false;
			default:
				this.Update();
				return Success;
		}
	}
	
	this.StartLink = function()
	{
		if(!SelectedNode)
			return;
		
		Linking = true;
		LinkingArrow = this.Svg.append("D3Svg:path").attr('class', "linking-arrow");
		UpdateGUI();
	}
	this.StopLink = function()
	{
		Linking = false;
		if(LinkingArrow) LinkingArrow.remove();
		UpdateGUI();
	}
	
	// Clicking on the background in the SVG unselects the selected node
	SvgContainer.Svg.on("mouseup.graph", function() {
		// Only unselect if the click had no dragging and was on the background
		if(SvgContainer.State == 1 && d3.event.target === SvgContainer.Svg.node() && self.Modifiable)
			NodeOnClick(null);
	});

	// For linking arrow to follow mouse
	d3.select('body').on('mousemove.graph', function(event) {
		if(Linking && LinkingArrow)
		{
			LinkingArrow.attr('d', function() {
				return 'M' + SelectedNode.x + ',' + SelectedNode.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1];
			});
		}
	});

	// Called when a node is clicked (but not dragged). Automatically applied to each node in SetGraph()
	var NodeOnClick = function(Node)
	{
		// If linking, link this node to the selected node
		if(Linking)
		{
			// Make sure there is a selected node and that it isn't this node
			if(Node && SelectedNode && SelectedNode !== Node)
			{
				if(SelectedNode.IsLinkedTo(Node))
				{
					SelectedNode.UnlinkFrom(Node);
					self.Update();
				}
				else
				{
					self.LinkNodes(SelectedNode, Node);
				}
			}
	
			self.StopLink();
			return;
		}
	
		if(!self.Modifiable)
			return;
	
		// Toggle selection on this node
		if(SelectedNode === Node)
			SelectedNode = null;
		else
			SelectedNode = Node;
		self.SelectNode(SelectedNode);
	}
	
	// Call whenever this.Nodes changes
	// Updates the graph SVG, and also updates the main GUI (calls this.UpdateGUICallback())
	this.Update = function()
	{
		Linking = false;
		if(LinkingArrow) LinkingArrow.remove();
		
		// Build links
		var GraphLinks = [];
		for(var i=0;i<this.Nodes.length;++i)
		{
			for(var j=0;j<this.Nodes[i].Parents.length;++j)
			{
				var degenerateLink = this.Nodes[i].IsParentDegenerate(j, this.MAX_CPT_ENTRIES_BEFORE_MANUAL_DEGENERACY_DECTION);
				var color = "#000";
				if(degenerateLink == 1)
					color = "red";
				else if(degenerateLink == 2)
					color = "orange";
				GraphLinks.push({"source":this.Nodes[i].Parents[j], "target":this.Nodes[i], "color":color});
			}
		}

		// Set properties for all the nodes
		for(var i=0;i<this.Nodes.length;++i)
		{
			if(typeof(this.Nodes[i].radius) !== 'number')
				this.Nodes[i].radius = DEFAULT_NODE_RADIUS;
			this.Nodes[i].height = this.Nodes[i].radius * 3; // Width and height for node collision detection
			this.Nodes[i].width = this.Nodes[i].radius * 3;
			this.Nodes[i].onClick = NodeOnClick;
		}

		// Update d3cola nodes and links, and restart it
		Cola.nodes(this.Nodes)
			.links(GraphLinks)
			.start().start(); // Not sure why, but calling start twice fixes some graphical issues

		// Add and remove SVG node elements based on the new graph data
		var SVGNodes = this.Svg.selectAll(".node") // Select all the SVG node elements (those where class=="node")
												 .data(this.Nodes, function (node) { return node.Name; }); // Apply the new node data to the SVG. Second param sets thename as the unique identifier, so that old and new nodes are created and removed properly
		SVGNodes.enter() // Gets a list of the newly-added node(s)
						 .append("g")
						  .attr("class", "node")
							.attr("n", function (node) { return node.Name; })
							.style("cursor", "default")
							.call(Cola.drag); // Call this to allow the SVG element to be draggable by d3cola
		SVGNodes.exit() // Gets a list of nodes that need to be removed
						 .remove(); // Remove the old nodes that are no longer in the graph
		
		// Add visuals to node elements
		SVGNodes.selectAll("*").remove(); // Clear the node before setting all its properties
		SVGNodes.append("circle")
						 .attr("class", "node-circle")
						 .attr("r", function (node) { return node.radius; });
		var NodeNameFontSize = 100;
		SVGNodes.append("text")
						 .attr("class", "node-name-text")
						 .text(function(node) { var length = 10; return node.Name.length > length ? node.Name.substring(0, length) : node.Name; })
						 .each(function(node) { // Set the size of the text to fit the node
								var fontSize = parseFloat(d3.select(this).style("font-size")); // parseFloat gets rid of the px/em/etc at the end
								fontSize *= Math.min(1, (node.radius*1.5) / this.getBBox().width); // scale the font size to fit in the node
								if(fontSize < NodeNameFontSize) // find the smallest font size
									NodeNameFontSize = fontSize;
						 })
						 .style("font-size", NodeNameFontSize + "px"); // Set them all to the smallest fontsize
		SVGNodes.append("title")
						 .text(function(node) { return node.Name; });
		
		this.UpdateNodeCPTs();
		
		// Add and remove SVG link elements based on the new graph data
		var SVGLinks = this.Svg.selectAll(".link")
												 .data(GraphLinks, function (link) { return link.source.Name + "," + link.target.Name; }); // Second param: give d3 a unique id for each link
		SVGLinks.enter()
						 .insert("D3Svg:path")
						 .attr("class", "link");
		SVGLinks.exit().remove();
		
		// Set links properties
		SVGLinks.attr("stroke", function (link) { return link.color; });

		// Update the d3cola tick function
		Cola.on("tick", function () {
			SVGNodes.attr("transform", function (node) { return "translate(" + node.x + "," + node.y + ")"; }); // Update the positions of the SVG node elements

			SVGLinks.attr('d', function (link) { // Lots of stuff from the original d3cola force-directed graph example. Positions the SVG link elements, it seems
				var deltaX = link.target.x - link.source.x,
				deltaY = link.target.y - link.source.y,
				dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
				normX = deltaX / dist,
				normY = deltaY / dist,
				sourcePadding = link.source.radius,
				targetPadding = link.target.radius + 2,
				sourceX = link.source.x + (sourcePadding * normX),
				sourceY = link.source.y + (sourcePadding * normY),
				targetX = link.target.x - (targetPadding * normX),
				targetY = link.target.y - (targetPadding * normY);
				return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
			});
		});

		// Clear variables
		Linking = false;

		// Callbacks
		for(var i=0;i<UpdateGraphCallbacks.length;++i)
			UpdateGraphCallbacks[i].func();
		UpdateGUI();
	}
	
	var UpdateGUI = function()
	{
		self.Svg.selectAll(".node-circle").attr("style", function (node) { return node === SelectedNode ? "fill:" + SelectionColor + ";" : "fill:white;"; });
		
		self.Svg.selectAll(".link").each(function(link) {
			if(link.source == SelectedNode)
				d3.select(this).style("opacity", 1);
			else
				d3.select(this).style("opacity", 0.4);
		});
		
		for(var i=0;i<UpdateGUICallbacks.length;++i)
			UpdateGUICallbacks[i].func();
	}
	
	this.UpdateNodeCPTs = function()
	{
		var SVGNodes = this.Svg.selectAll(".node");
		SVGNodes.selectAll(".node-cpt-text").remove();
		SVGNodes.selectAll(".node-cpt-highlighted-text").remove();
		
		if(!ShowCPTs)
			return;
		
		SVGNodes.each(function(node) {
			var cpList = node.ListCPT();
			
			for(var i=0;i<Math.min(cpList.length, 10);++i)
			{
				var conditionStr = "";
				for(var j=0;j<cpList[i].condition.length;++j)
					conditionStr += node.Parents[j].GetShortenedDomain().svg[cpList[i].condition[j]]
				
				var prefStr = "";
				
				for(var j=0;j<cpList[i].preference.length;++j)
				{
					if(j%2 === 1)
						prefStr += (cpList[i].preference[j] ? " ≽ " : " ≻ ");
					else
						prefStr += node.Domain[cpList[i].preference[j] < 0 ? (-cpList[i].preference[j] - 1) : cpList[i].preference[j]];
				}
				
				var line = (conditionStr ? (conditionStr + ": ") : "") + prefStr;
				
				d3.select(this).append("text")
					.attr('class', "node-name-text " + (cpList[i].highlight ? "node-cpt-highlighted-text" : "node-cpt-text"))
					.attr('x', (node.radius*1.5) + "px")
					.attr('y', (1.2*i)+"em")
					.html(line);
			}
		});
	}
}




function DraggableSVG()
{
	var self = this;
	
	// Create objects
	self.Svg = d3.select(document.createElementNS(d3.ns.prefix.svg, 'svg'))
							.attr('width', '100%').attr('height', '100%');
	self.Body = self.Svg.append('g');
	
	// Consts
	var ZOOM_RANGE = {max:10, min:0.5, delta:0.1, def:3.5};
	
	// Vars
	self.State = 0; // 0: nothing, 1: mouse down, 2: dragging (once dragging starts, stays at 2 until mouse is released)
	var DraggingOfset = [0, 0];
	var Scale = ZOOM_RANGE.def;
	var Translation = [document.documentElement.clientWidth/2, document.documentElement.clientHeight/2];
	
	// Inital translation
	self.Body.attr("transform", "translate(" + Translation[0] + "," + Translation[1] + ") scale(" + Scale + ")");
	
	// Mouse down
	self.Svg.on("mousedown.default", function() {
		if(d3.event.target !== self.Svg.node()) // Only drag if the click is on the background
			return;

		var coordinates = [0, 0];
		coordinates = d3.mouse(this);
		
		self.State = 1;
		DraggingOfset = [coordinates[0] - Translation[0], coordinates[1] - Translation[1]];
	});
	
	// Global mouse events
	document.addEventListener('mouseup', function() {
		self.State = 0;
	}, false);
	document.addEventListener('mousemove', function(event) {
		if(self.State > 0)
		{
			event.stopPropagation(); // Keep from selecting everything
	    event.preventDefault();

			Translation[0] = event.clientX - DraggingOfset[0]; // Get the new SVG translation
			Translation[1] = event.clientY - DraggingOfset[1];
			self.Body.attr("transform", "translate(" + Translation[0] + "," + Translation[1] + ") scale(" + Scale + ")"); // Apply it
			self.State = 2;
		}
	}, false);
	
	// Scrolling
	function OnScroll(event)
	{
		var ScrollDelta = Math.max(-1, Math.min(1, d3.event.wheelDeltaY));
		Scale += ScrollDelta * ZOOM_RANGE.delta;
		if(Scale < ZOOM_RANGE.min) Scale = ZOOM_RANGE.min;
		else if(Scale > ZOOM_RANGE.max) Scale = ZOOM_RANGE.max;
		self.Body.attr("transform", "translate(" + Translation[0] + "," + Translation[1] + ") scale(" + Scale + ")");
	}

	self.Svg.on("mousewheel.zoom", OnScroll); // IE9, Chrome, Safari, Opera
	self.Svg.on("DOMMouseScroll.zoom", OnScroll); // Firefox
	self.Svg.on("wheel.zoom", OnScroll); // Firefox
}
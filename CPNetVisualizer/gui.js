// Vars
var DefaultNodeRadius = 10; // const
var Linking = false;
var SelectedNode = null;
var Saved = true;
var GraphNodes = [];

// Initialize d3cola and the SVG
var D3CoLa = cola.d3adaptor().avoidOverlaps(true).flowLayout("y", 60).symmetricDiffLinkLengths(12).handleDisconnected(false);
var D3Svg = d3.select("#main-svg-graph");
D3Svg.append('svg:defs') // Define arrow markers for graph links
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

// Get elements
var MainSVG = document.getElementById("main-svg");
var SVGDragger = document.getElementById("main-svg-dragger");
var AddNodeButton = document.getElementById("add-node-button");
var DeleteNodeButton = document.getElementById("delete-node-button");
var LinkNodeButton = document.getElementById("link-node-button");
var AffixNodeButton = document.getElementById("affix-node-button");

var AllowCyclesCheckbox = document.getElementById("allow-cycles-checkbox");
var AutodetectDegeneracy = document.getElementById("autodetect-degeneracy-checkbox");
var MaxInNodesSelector = document.getElementById("max-in-nodes-selector");

var CPNetNameInput = document.getElementById("cp-net-name-input");
var FileUploadButton = document.getElementById("file-upload"); // hidden, but still used!

var NodeNameDisplay = document.getElementById("node-name-display");
var NodeNameInput = document.getElementById("node-name-input");

var DomainListTextarea = document.getElementById("domain-list-textarea");
var ParentsListTable = document.getElementById("parents-list-table");
var CPTTable = document.getElementById("cpt-table");

var MessageBar = document.getElementById("message-bar");
var SavedNotifier = document.getElementById("saved-notifier");



////////////////////////////////////////////////////////////////////////////////////////////////
// SVG DRAGGING AND SIZING
////////////////////////////////////////////////////////////////////////////////////////////////

var SVGDragging = false;
var SVGDragged = false;
var SVGTranslation = [document.documentElement.clientWidth/2, document.documentElement.clientHeight/2];
var SVGScale = 1;
D3Svg.attr("transform", "translate(" + SVGTranslation[0] + "," + SVGTranslation[1] + ") scale(" + SVGScale + ")");

SVGDragger.onmousedown = function(event) { // SVG dragger mouse down
	SVGDragging = true;
	SVGDraggingOfset = [event.clientX - SVGTranslation[0], event.clientY - SVGTranslation[1]];
	SVGDragged = false;
};
SVGDragger.onmouseup = function() {
	if(SVGDragging && !SVGDragged)
		SelectNode(null); // Clicking on the background unselects the nodes
};
document.onmouseup = function() { // Mouse up for everything
	SVGDragging = false;
};
document.onmousemove = function(event) { // Mouse move for everything
	if(SVGDragging)
	{
		event.stopPropagation(); // Keep from selecting everything
    	event.preventDefault();

		SVGTranslation[0] = event.clientX - SVGDraggingOfset[0]; // Get the new SVG translation
		SVGTranslation[1] = event.clientY - SVGDraggingOfset[1];
		D3Svg.attr("transform", "translate(" + SVGTranslation[0] + "," + SVGTranslation[1] + ") scale(" + SVGScale + ")"); // Apply it
		SVGDragged = true;
	}
};

function OnScroll(event) {
	var ScrollDelta = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)));
	SVGScale += ScrollDelta * 0.1;
	if(SVGScale < 0.1)
		SVGScale = 0.1;
	else if(SVGScale > 10)
		SVGScale = 10;
	D3Svg.attr("transform", "translate(" + SVGTranslation[0] + "," + SVGTranslation[1] + ") scale(" + SVGScale + ")");
}

MainSVG.addEventListener("DOMMouseScroll", OnScroll); // Firefox
MainSVG.addEventListener("mousewheel", OnScroll); // IE9, Chrome, Safari, Opera
SVGDragger.addEventListener("DOMMouseScroll", OnScroll); // Firefox
SVGDragger.addEventListener("mousewheel", OnScroll); // IE9, Chrome, Safari, Opera

function CenterViewport()
{
	SVGTranslation = [document.documentElement.clientWidth/2, document.documentElement.clientHeight/2];
	SVGScale = 1;
	D3Svg.attr("transform", "translate(" + SVGTranslation[0] + "," + SVGTranslation[1] + ") scale(" + SVGScale + ")");
}



////////////////////////////////////////////////////////////////////////////////////////////////
// GUI EVENT HANDLING
////////////////////////////////////////////////////////////////////////////////////////////////

/// LEFT SIDE

function AddNodeButtonClicked()
{
	var N = new Node((new Date()).getTime());
	if(SelectedNode)
		SelectedNode.LinkTo(N);
	N.AddToGraph(GraphNodes);
	UpdateGraph();
	SetSaved(false);
}

function RemoveNodeButtonClicked()
{
	if(!SelectedNode)
		return;

	var N = SelectedNode;
	SelectNode(null);
	N.Destroy(GraphNodes);
	UpdateGraph();
	SetSaved(false);
}

function LinkNodesButtonClicked()
{
	if(SelectedNode)
		Linking=true;
}

function AffixNodeButtonClicked()
{
	AffixNode(SelectedNode);
}

function AllowCyclesCheckChanged()
{
	AllowCycles = AllowCyclesCheckbox.checked;
}

function AutodetectDegeneracyCheckChanged()
{
	// TODO
}

function MaxInNodesSelectorChanged()
{
	MaxInNodes = MaxInNodesSelector.value;
	UpdateGUI();
}

/// RIGHT SIDE

function NodeNameInputChanged() // set to oninput; called on every character typed
{
	if(!SelectedNode)
		return;

	SelectedNode.SetName(NodeNameInput.value);
	UpdateGUI();
	SetSaved(false);
}

function DomainInputChanged() // set to onchange; only called when user is finished changing the domain
{
	if(!SelectedNode)
		return;

	SelectedNode.SetDomain(DomainListTextarea.value.split("\n").filter(function(el) {
		return !isEmptyOrSpaces(el);
	}));
	UpdateGUI();
	SetSaved(false);
}

function AddParentNodeButtonClicked()
{
	if(!SelectedNode)
		return;

	var Dropdown = document.getElementById("addparent-dynamic-dropdown");
	if(!Dropdown)
		return;

	for(var i=0;i<GraphNodes.length;++i)
	{
		if(GraphNodes[i].Name == Dropdown.value) // Use == instead of === because DropDown.value is weird
		{
			if(!LinkNodes(GraphNodes[i], SelectedNode))
				return;
			break;
		}
	}

	UpdateGraph();
	SetSaved(false);
}

function RemoveParentNodeButtonClicked(ParentIndex)
{
	if(!SelectedNode || ParentIndex >= SelectedNode.Parents.length)
		return;

	SelectedNode.Parents[ParentIndex].UnlinkFrom(SelectedNode);
	UpdateGraph();
	SetSaved(false);
}

function SelectParentItemClicked(ParentIndex)
{
	if(!SelectedNode || ParentIndex >= SelectedNode.Parents.length)
		return;
	SelectNode(SelectedNode.Parents[ParentIndex]);
}

function CPTListItemClicked(CPTListIndex, PreferenceIndex, ToggleDisable)
{
	if(!SelectedNode)
		return;

	// Get the preference that was clicked
	var CPTList = SelectedNode.ListCPT();
	var Preference = CPTList[CPTListIndex].preference;

	// If PreferenceIndex is odd, then it is a succeeds indicator, so toggle it
	if(PreferenceIndex % 2 === 1)
	{
		// Toggle
		Preference[PreferenceIndex] = !Preference[PreferenceIndex];

		// Update GUI
		CPTTable.innerHTML = GenerateCPTHTML(SelectedNode); // Don't refresh the entire GUI, just the CPT table
		return;
	}

	// If ToggleDisable, just toggle the disabled state on the item
	if(ToggleDisable)
	{
		Preference[PreferenceIndex] = (-Preference[PreferenceIndex]) - 1;
		CPTTable.innerHTML = GenerateCPTHTML(SelectedNode);
		return;
	}

	// If the item is disabled, don't do anything
	if(Preference[PreferenceIndex] < 0)
		return;

	// Otherwise, it was a regular item. Find the next available index
	// If none are found, Nextindex should be the same as when it started
	var NextDomainIndex = Preference[PreferenceIndex];
	for(var x=0;x<SelectedNode.Domain.length;++x) // Try once for each domain item
	{
		++NextDomainIndex;
		if(NextDomainIndex >= SelectedNode.Domain.length)
			NextDomainIndex = 0;
		var used = false;
		for(var i=0;i<PreferenceIndex;i+=2) // Do +2 since every other preference index is for the succeeds/succeeds-or-equal-to
		{
			if(NextDomainIndex === Preference[i] || NextDomainIndex === (-Preference[i] - 1))
			{
				used = true;
				break;
			}
		}

		if(!used)
			break;
	}	

	// Check for no change
	if(NextDomainIndex === Preference[PreferenceIndex])
		return;

	// Swap with any following indices
	for(var i=PreferenceIndex+2;i<Preference.length;i+=2)
	{
		if(NextDomainIndex === Preference[i] || NextDomainIndex === (-Preference[i] - 1))
		{
			Preference[i] = Preference[PreferenceIndex];
			break;
		}
	}

	// Update the original index's domain value
	Preference[PreferenceIndex] = NextDomainIndex;

	// Update GUI
	CPTTable.innerHTML = GenerateCPTHTML(SelectedNode);
}



////////////////////////////////////////////////////////////////////////////////////////////////
// Loading and Saving
////////////////////////////////////////////////////////////////////////////////////////////////

function SetSaved(Saved)
{
	window.Saved = Saved;
	SavedNotifier.innerHTML = "currently " + (Saved ? "saved" : "UNSAVED");
}

function LoadDefaultCPNet()
{
	// Reset the graph
	SelectNode(null);
	GraphNodes = [];

	// Create nodes
	var WeatherNode = new Node("Weather");
	var TimeNode = new Node("Time");
	var ActivityNode = new Node("Activity");
	var FriendNode = new Node("Friend");

	// Set their domain
	WeatherNode.SetDomain(["Fair", "Rain"]);
	TimeNode.SetDomain(["Morning", "Afternoon"]);
	ActivityNode.SetDomain(["Cycling", "Table Tennis"]);
	FriendNode.SetDomain(["Emily", "Henry"]);

	// Link them
	WeatherNode.LinkTo(ActivityNode);
	TimeNode.LinkTo(ActivityNode);
	ActivityNode.LinkTo(FriendNode);

	// TODO: Build preferences

	// Add them to the graph
	WeatherNode.AddToGraph(GraphNodes);
	TimeNode.AddToGraph(GraphNodes);
	ActivityNode.AddToGraph(GraphNodes);
	FriendNode.AddToGraph(GraphNodes);
	UpdateGraph();

	// Set to saved
	SetSaved(true);
}

function LoadNewCPNet()
{
	// Reset the graph
	SelectNode(null);
	GraphNodes = [];

	// Create and add node to the graph
	(new Node("root node")).AddToGraph(GraphNodes);
	UpdateGraph();

	// Set to saved
	SetSaved(true);
}

function LoadCPNetFromFile()
{
	// Make sure the user's browser supports loading files
	if (!window.File || !window.FileList || !window.FileReader || !window.Blob)
	{
		MessageBar.innerHTML = "Unable to load file due to no file reading support. Update your dang browser.";
		FileUploadButton.value = "";
		return;
	}

	// TODO: Ask user if they want to overwrite their current cp-net if it's unsaved

	// Set the file upload button's change event handler
	FileUploadButton.addEventListener('change', function (event) {
		// Get first selected file
		var File = event.target.files;
		if(File.length <= 0)
			return;
		File = File[0];

		// Read file contents
		var Reader = new FileReader();

		// Closure to capture the file information.
		Reader.onload = function(e) {
			var graph = XMLToGraph(e.target.result);
			if(graph)
			{
				// Get file name
				CPNetNameInput.value = File.name.replace(/\.[^/.]+$/, ""); // Remove the file extension from the name
				
				// Set graph
				SelectNode(null);
				GraphNodes = graph;
				UpdateGraph();

				// Set to saved
				SetSaved(true);
			}
			else
			{
				MessageBar.innerHTML = "Unable to load file due to bad XML.";
			}

			FileUploadButton.value = "";
		};

		// Read in the image file as a data URL.
		Reader.readAsText(File);
	}, false);

	// Open the file upload dialog
	FileUploadButton.value = ""; // Clear the file upload button's current file so that a new file can be loaded
	FileUploadButton.click(); // Simulate clicking the button
}

function SaveCPNetAsXML()
{
	// Convert the Graoh to XML
	var XmlString = GraphToXML(GraphNodes);

	// Get the save name
	var Name = CPNetNameInput.value;
	if(isEmptyOrSpaces(Name))
		Name = "cpnet";

	// Save it (just downloads the file)
	var blob = new Blob([XmlString], {type: "text/plain;charset=utf-8"});
	saveAs(blob, Name + ".xml"); // From the FileSaver.js API

	// Set to saved
	SetSaved(true);
}

// Load the default CPNet when the window finishes loading
window.onload = function()
{
	LoadDefaultCPNet();
}



////////////////////////////////////////////////////////////////////////////////////////////////
// Graph editing utils
////////////////////////////////////////////////////////////////////////////////////////////////

// Selects SelectedNode and unselects all other nodes. Specify null to unselect everything
function SelectNode(SelectedNode)
{
	window.SelectedNode = SelectedNode;
	UpdateGUI();
}

// Affixes a node so that it does not move (unless manually dragged)
// Specify Affix to set if affixed or not, or don't specify to toggle affixed
function AffixNode(Node, Affix)
{
	if(!Node)
		return;

	if(typeof(Affix) === 'undefined')
		Node.fixed = Node.fixed ^ 1<<0;
	else
		Node.fixed = Node.fixed ^ ((-(Affix==true) ^ Node.fixed) & (1 << 0));
	D3CoLa.start();

	if(SelectedNode === Node)
		AffixNodeButton.value = Node.fixed ? "Unaffix Selected Node" : "Affix Selected Node";
}

function LinkNodes(SourceNode, TargetNode)
{
	var Success = SourceNode.LinkTo(TargetNode);
	switch(Success)
	{
		case "badcycle":
			MessageBar.innerHTML = "Cannot create link because it will make a cycle.";
			return false;
		case "toomanyins":
			MessageBar.innerHTML = "Cannot create link because it will give the target node too many in-nodes.";
			return false;
		default:
			SetSaved(false);
			return Success;
	}
}

// Called when a node is clicked (but not dragged). Automatically applied to each node in SetGraph()
function NodeOnClick(Node)
{
	// If linking, link this node to the selected node
	if(Linking)
	{
		// Make sure there is a selected node and that it isn't this node
		if(SelectedNode && SelectedNode !== Node)
		{
			if(SelectedNode.IsLinkedTo(Node))
				SelectedNode.UnlinkFrom(Node);
			else
				LinkNodes(SelectedNode, Node);
		}

		Linking = false;
		return;
	}

	// Toggle selection on this node
	if(SelectedNode === Node)
		SelectedNode = null;
	else
		SelectedNode = Node;
	SelectNode(SelectedNode);
}



////////////////////////////////////////////////////////////////////////////////////////////////
// GUI Update
////////////////////////////////////////////////////////////////////////////////////////////////

// Call whenever GraphNodes changes
// Updates the graph SVG, and also updates the main GUI (calls UpdateGUI())
function UpdateGraph()
{
	// Build links
	var GraphLinks = [];
	for(var i=0;i<GraphNodes.length;++i)
		for(var j=0;j<GraphNodes[i].Parents.length;++j)
			GraphLinks.push({"source":GraphNodes[i].Parents[j], "target":GraphNodes[i]});

	// Set properties for all the nodes
	for(var i=0;i<GraphNodes.length;++i)
	{
		if(typeof(GraphNodes[i].radius) !== 'number')
			GraphNodes[i].radius = DefaultNodeRadius;
		GraphNodes[i].height = GraphNodes[i].radius * 3; // Width and height for node collision detection
		GraphNodes[i].width = GraphNodes[i].radius * 3;
		GraphNodes[i].onClick = NodeOnClick;
	}

	// Update d3cola nodes and links, and restart it
	D3CoLa.nodes(GraphNodes)
		.links(GraphLinks)
		.start().start(); // Not sure why, but calling start twice fixes some graphical issues

	// Add and remove SVG node elements based on the new graph data
	var SVGNodes = D3Svg.selectAll(".node") // Select all the SVG node elements (those where class=="node")
						.data(GraphNodes, function (node) { return node.Name; }); // Apply the new node data to the SVG. Second param sets thename as the unique identifier, so that old and new nodes are created and removed properly
	SVGNodes.enter() // Gets a list of the newly-added node(s)
			.append("circle") // Create a new SVG element for the new node(s)
			 .attr("class", "node")
			 .attr("n", function (node) { return node.Name; })
			 .attr("r", function (node) { return node.radius; })
			 .style("fill", function (node) { return node.color; })
			 .call(D3CoLa.drag); // Call this to allow the SVG element to be draggable by d3cola
	SVGNodes.exit() // Gets a list of nodes that need to be removed
			.remove(); // Remove the old nodes that are no longer in the graph
	SVGNodes = D3Svg.selectAll(".node"); // Reselect the SVG node elements since things have changed (is this necessary?)
	
	SVGNodes.selectAll("title").remove(); // Remove all the nodes titles and reset them (TODO: There is probably a better way to do this...)
	SVGNodes.append("title").text(function (node) { return node.Name; });

	// Add and remove SVG link elements based on the new graph data
	var SVGLinks = D3Svg.selectAll(".link")
						.data(GraphLinks, function (link) { return link.source.Name + "," + link.target.Name; }); // Second param: give d3 a unique id for each link
	SVGLinks.enter()
			.insert("D3Svg:path", "aftercrosshair")
			 .attr("class", "link");
	SVGLinks.exit().remove();
	SVGLinks = D3Svg.selectAll(".link");

	// Update the d3cola tick function
	D3CoLa.on("tick", function () {
		SVGNodes.attr("cx", function (node) { return node.x; }) // Update the positions of the SVG node elements
				.attr("cy", function (node) { return node.y; });

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

	// Check for cycles
	// More of a GUI update, but only changes when the nodes do, so keep this here
	var Cycles = DoesGraphHaveCycle(GraphNodes);
	if(Cycles)
		AllowCyclesCheckbox.checked = true;
	AllowCyclesCheckbox.disabled = Cycles;

	// Clear variables
	Linking = false;
	Saved = false;

	// Update GUI
	UpdateGUI();
}

// Update the main GUI, call whenever node properties change, or the selected node changes, etc
function UpdateGUI()
{
	// Stroke the selected node red
	D3Svg.selectAll(".node").attr("style", function (node) {
		if(node === SelectedNode)
			return "stroke:red;";
		else
			return "stroke:white;";
	});

	// Clear the message bar
	MessageBar.innerHTML = " ";

	// Change the GUI depending on if there is a selected node
	if(SelectedNode)
	{
		/// LEFT SIDE

		AddNodeButton.value = "Add Child Node to Selected";
		DeleteNodeButton.disabled = false;
		LinkNodeButton.disabled = false;
		AffixNodeButton.disabled = false;
		AffixNodeButton.value = ((SelectedNode.fixed & 1) == 1) ? "Unaffix Selected Node" : "Affix Selected Node";

		/// RIGHT SIDE

		NodeNameDisplay.innerHTML = SelectedNode.Name;
		NodeNameInput.value = SelectedNode.Name;
		NodeNameInput.disabled = false;
		DomainListTextarea.disabled = false;
		DomainListTextarea.style.backgroundColor = "white";
		DomainListTextarea.value = SelectedNode.Domain.join("\n");
		ParentsListTable.style.backgroundColor = "white";
		ParentsListTable.innerHTML = GenerateParentsListHTML(SelectedNode);
		CPTTable.style.backgroundColor = "white";
		CPTTable.innerHTML = GenerateCPTHTML(SelectedNode);
	}
	else
	{
		/// LEFT SIDE

		AddNodeButton.value = "Add Root Node"; // AddNodeButton adds a root node with no selected node
		DeleteNodeButton.disabled = true;
		LinkNodeButton.disabled = true;
		AffixNodeButton.disabled = true;
		AffixNodeButton.value = "Affix Selected Node";

		/// RIGHT SIDE

		NodeNameDisplay.innerHTML = "no selected node";
		NodeNameInput.value = "";
		NodeNameInput.disabled = true;
		DomainListTextarea.disabled = true;
		DomainListTextarea.style.backgroundColor = "#EEEEEE";
		DomainListTextarea.value = "";
		ParentsListTable.style.backgroundColor = "#EEEEEE";
		ParentsListTable.innerHTML = "";
		CPTTable.style.backgroundColor = "#EEEEEE";
		CPTTable.innerHTML = "";
	}
}

function GenerateParentsListHTML(Node)
{
	// Generate the parents list
	var HTML = "";
	for(var i=0;i<Node.Parents.length;++i)
	{
		HTML += "<tr class='parents-table-row' onclick='SelectParentItemClicked(" + i + ")'> <td width='10%'> <img src='removeitem.png' alt='Remove Node' onclick='RemoveParentNodeButtonClicked(" + i + ")'/> </td>";
		HTML += "<td width='90%'> <p>" + Node.Parents[i].Name + "</p>";

		for(var j=0;j<Node.Parents[i].Domain.length;++j)
			HTML += "<p style='font-size:0.6em;padding:0;'>&emsp;&emsp;" + String.fromCharCode(97 + i) + (j+1) + ": " + Node.Parents[i].Domain[j] + "</p>";
		HTML += "</td> </tr>";
	}

	// Create the add parent node button
	if(Node.Parents.length < MaxInNodes)
	{
		// Get a list of nodes that could be added as parents to this node
		// (cant add self or any current parents as parent nodes)
		var addableNodes = [];
		for(var i=0;i<GraphNodes.length;++i)
			if(GraphNodes[i] !== Node && Node.Parents.indexOf(GraphNodes[i]) < 0)
				addableNodes.push(GraphNodes[i]);

		// Create the dropdown box and add button
		if(addableNodes.length > 0)
		{
			// Add the addnode row
			HTML += "<tr> <td width='10%'> <img src='additem.png' alt='Add Node' onclick='AddParentNodeButtonClicked()'> </td>";
			
			// Add the dropdown box
			HTML += "<td width='90%'> <select id='addparent-dynamic-dropdown'>";
			for(var i=0;i<addableNodes.length;++i)
				HTML += "<option value=" + addableNodes[i].Name + ">" + addableNodes[i].Name + "</option>";
			HTML += "</select> </td> </tr>";
		}
	}

	return HTML;
}

function GenerateCPTHTML(Node)
{
	var HTML = "";

	// Get the Node's CPT as a list
	var CPList = Node.ListCPT();

	for(var i=0;i<CPList.length;++i)
	{
		// Get the condition string
		var conditionStr = "";
		for(var j=0;j<CPList[i].condition.length;++j)
			conditionStr += String.fromCharCode(97 + j) + (CPList[i].condition[j]+1);

		// Add the condition
		HTML += "<tr> <td width='1px'> <p>" + conditionStr + ":&nbsp;&nbsp;</p> </td> <td>";

		// Add the preference
		for(var j=0;j<CPList[i].preference.length;++j)
		{
			if(j%2 === 1)
				HTML += "<p class='cpt-table-item' onclick='CPTListItemClicked(" + i + "," + j + ");event.preventDefault();'> " + (CPList[i].preference[j] ? "≽" : "≻") + " </p>";
				//HTML += "<p class='cpt-table-item-noclick'> ≻ </p>";
			else// if(j < CPList[i].preference.length - 1)
				HTML += "<p class='cpt-table-item" + (CPList[i].preference[j] < 0 ? "-disabled" : "") + "' onclick='CPTListItemClicked(" + i + "," + j + ", event.shiftKey);event.preventDefault();'>" + Node.Domain[CPList[i].preference[j] < 0 ? (-CPList[i].preference[j] - 1) : CPList[i].preference[j]] + "</p>";
			//else
			//	HTML += "<p class='cpt-table-item-noclick'>" + Node.Domain[CPList[i].preference[j]] + "</p>";
				
		}

		HTML += "</td> </tr>";
	}

	return HTML;
}
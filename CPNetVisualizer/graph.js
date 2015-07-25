var AllowCycles = false; // Can be set by GUI
var MaxInNodes = 5; // Can be set by GUI


////////////////////////////////////////////////////////////////////////////////////////////////
// CYCLE DETECTION
////////////////////////////////////////////////////////////////////////////////////////////////

// Returns true if the graph contains any cycles anywhere, false otherwise
// You should NOT call ClearCyclesVisited() after calling this
function DoesGraphHaveCycle(GraphNodes)
{
	// Run IsNodeCyclic on every node in the graph
	for(var i=0;i<GraphNodes.length;++i)
		if(IsNodeCyclic(GraphNodes[i]))
			return true;
	return false;
}

// Returns true if the given StartingNode is part of a cycle.
// Do not pass any argument to CurrentNode or VisitedNodes.
// Always call ClearCyclesVisited() after calling this (or clear the cycle_detect_visited tag from all involved nodes)
function IsNodeCyclic(StartingNode, CurrentNode, VisitedNodes)
{
	// If we've reached the StartingNode, there is a cycle
	if(StartingNode === CurrentNode)
		return true;

	// Set starting values
	if(!CurrentNode)
		CurrentNode = StartingNode; // If this is the first iteration, make the StartingNode current
	if(!VisitedNodes)
		VisitedNodes = [];

	// Exit if this node has already been visited
	if(VisitedNodes.indexOf(CurrentNode) >= 0)
		return false;

	// Add this node to the visited nodes list
	VisitedNodes.push(CurrentNode);

	// Recurse on all parents
	for(var i=0;i<CurrentNode.Parents.length;++i)
		if(IsNodeCyclic(StartingNode, CurrentNode.Parents[i], VisitedNodes)) // If a cycle was found, return true immediately
			return true;

	return false;
}



////////////////////////////////////////////////////////////////////////////////////////////////
// NODE MANAGEMENT FUNCTIONS
////////////////////////////////////////////////////////////////////////////////////////////////

function Node(Name_)
{
	this.Name = "";
	this.Domain = [];
	this.Parents = [];
	this.Children = [];
	this.CPT = [];

	// Sets this node's name
	// Optionally, if GraphNodes is specified, does not set name and returns false if the given name matches any existing node name
	// Returns false if the new name is empty (blank or only whitespace)
	this.SetName = function (Name, GraphNodes)
	{
		// Make sure the new name isn't blank
		if(isEmptyOrSpaces(Name))
			return false;

		//Name = Name.replace(/\s+/g, '-'); // Name can't have spaces, to convert them to hyphens

		// Make sure the name isn't a duplicate
		if(GraphNodes)
		{
			for(var i=0;i<GraphNodes.length;++i)
				if(GraphNodes[i].Name === Name)
					return false;
		}

		// Set the name
		this.Name = Name;
		return true;
	}
	this.SetName(Name_); // Set default name

	// Sets this node's domain
	// Set DontUpdate to true to not update the graph (to not call UpdateGraph())
	this.SetDomain = function (Domain)
	{
		// Set the domain
		this.Domain = Domain;

		// TODO: Update CPT table of Node's child nodes
		this.GenerateCPT();
		for(var i=0;i<this.Children.length;++i)
			this.Children[i].GenerateCPT();
	}

	// Links this node to TargetNode and updates the TargetNode's CPT table
	// Returns "badcycle" if the link creates a cycle and cycles aren't allowed (and does not create the link)
	// Returns "toomanyins" if the link creates too many in-nodes to TargetNode (and does not create the link)
	// Returns true on success
	this.LinkTo = function (TargetNode)
	{
		// Validate nodes
		if(!TargetNode)
			return false;

		// Check if they're already linked
		if(this.IsLinkedTo(TargetNode))
			return true;

		// Check for too many in-nodes
		if(TargetNode.Parents.length + 1 > MaxInNodes)
			return "toomanyins";

		// Add the link
		TargetNode.Parents.push(this);
		this.Children.push(TargetNode);

		// Check for cycles
		if(!AllowCycles && IsNodeCyclic(TargetNode))
		{
			TargetNode.Parents.pop();
			this.Children.pop();
			return "badcycle";
		}

		// TODO: Update the TargetNode's CPT
		TargetNode.GenerateCPT();

		// Create a default order
		// var order = [];
		// for(var x=0;x<TargetNode.domain.length;++x)
		// 	order.push(x);

		return true;
	}

	// Removes all links from this node to TargetNode
	this.UnlinkFrom = function (TargetNode)
	{
		// Validate nodes
		if(!TargetNode)
			return;

		// Make sure that TargetNode is a child of SourceNode
		var ParentIndex = TargetNode.Parents.indexOf(this);
		if(ParentIndex < 0)
			return;

		// Remove the link
		TargetNode.Parents.splice(ParentIndex, 1);

		var ChildIndex = this.Children.indexOf(TargetNode);
		this.Children.splice(ChildIndex, 1);

		TargetNode.GenerateCPT();
	}

	// Returns true if this node is a parent of TargetNode
	this.IsLinkedTo = function (TargetNode)
	{
		// Validate nodes
		if(!TargetNode)
			return false;

		// Check
		return TargetNode.Parents.indexOf(this) >= 0;
	}

	// Adds this node to the given graph
	// Returns false if this node has a blank name or this node's name matches any other node's name in the graph
	this.AddToGraph = function (GraphNodes)
	{
		if(isEmptyOrSpaces(this.Name)) // Can't add before setting a name
			return false;

		for(var i=0;i<GraphNodes.length;++i)
			if(GraphNodes.Name == this.Name)
				return false;

		GraphNodes.push(this);
		return true;
	}

	// Removes this node from all its parents and child nodes and erases all its data and removes it from the global graph
	// Optionally, if GraphNodes is specified, removes this node from the given Graph
	this.Destroy = function (GraphNodes)
	{
		// Remove all outgoing links from this node
		var ChildCount = this.Children.length; // UnlinkFrom modifies the child count, so cache the variable
		for(var i=0;i<ChildCount;++i)
			this.UnlinkFrom(this.Children[0], true);

		// Remove all incoming links
		var ParentCount = this.Parents.length;
		for(var i=0;i<ParentCount;++i)
			this.Parents[0].UnlinkFrom(this, true);

		// TODO: Update the child nodes' CPTs
		for(var i=0;i<this.Children.length;++i)
			this.Children[i].GenerateCPT();

		// Remove from graph
		if(GraphNodes)
		{
			var NodeIndex = GraphNodes.indexOf(this);
			if(NodeIndex >= 0)
				GraphNodes.splice(NodeIndex, 1);
		}

		// Delete data
		this.Domain = [];
		this.Parents = [];
		this.Children = [];
		this.CPT = [];
	}

	// Generates a blank CPT for the given Node
	this.GenerateCPT = function ()
	{
		var dimensions = [];
		for(var i=0;i<this.Parents.length;++i)
			dimensions.push(this.Parents[i].Domain.length);

		this.CPT = createNDimArray(dimensions);

		// TEMP: FILL CPT
		var pref = [];
		for(var i=0;i<this.Domain.length;++i)
			pref[i] = i;

		var cplist = this.ListCPT();
		for(var i=0;i<cplist.length;++i)
			this.SetPreference(cplist[i].condition, pref);
	}

	// Returns the Node's CPT as an array
	// Do not pass any arguments to this function
	this.ListCPT = function (CPTSection, Dimension)
	{
		if(typeof(CPTSection) === 'undefined')
			CPTSection = this.CPT;
		if(typeof(Dimension) === 'undefined')
			Dimension = [];

		if(this.Parents.length == 0)
			return [];
		if(Dimension.length >= this.Parents.length)// || !CPTSection.isArray())
			return {"condition":Dimension, "preference":CPTSection};

		var List = [];
		for(var i=0;i<CPTSection.length;++i)
		{
			var newList = this.ListCPT(CPTSection[i], Dimension.concat([i]));
			if(newList.condition && newList.preference)
				List.push(newList);
			else
				List = List.concat(newList);
		}
		return List;
	}

	this.SetPreference = function (Condition, Preference)
	{
		//if(!Condition.isArray() || !Preference.isArray())
		//	return;

		if(Condition.length != this.Parents.length)
			return;

		var PrevPref = this.CPT;
		for(var i=0;i<Condition.length;++i)
			PrevPref = PrevPref[Condition[i]];

		PrevPref.length = 0; // Clear existing preference
		for(var i=0;i<Preference.length;++i)
			PrevPref[i] = Preference[i];
	}
}

/*
Condition:
[parent1domainindex, parent2domainindex, ...]

Preference:
[domainindex, domainindex, domainindex, ...]

A preference statement:
[condition, value]

*/



// TEMP
function createNDimArray(dimensions) {
    if (dimensions.length > 0) {
        var dim = dimensions[0];
        var rest = dimensions.slice(1);
        var newArray = new Array();
        for (var i = 0; i < dim; i++) {
            newArray[i] = createNDimArray(rest);
        }
        return newArray;
     } else {
        return [];
     }
 }




////////////////////////////////////////////////////////////////////////////////////////////////
// SAVING AND LOADING THE GRAPH TO/FROM DISK
////////////////////////////////////////////////////////////////////////////////////////////////

// Takes an XML string and converts it into a d3cola graph nodes list
// Returns null if there is no XML or it is invalid
function XMLToGraph(XmlString)
{
	// Create the graph
	var NewGraphNodes = [];

	if(isEmptyOrSpaces(XmlString))
		return null;

	// Parse the XML and make sure it has a valid root
	var Root = parseXml(XmlString);
	if(!Root)
		return null;

	if(!Root.childNodes || Root.childNodes.length <= 0)
		return null;
	Root = Root.getElementsByTagName("PREFERENCE-SPECIFICATION")[0];
	if(!Root || !Root.childNodes || Root.childNodes.length <= 0)
		return null;

	// Read preference nodes
	var NodeNamesToNodes = {};
	for(var i=0;i<Root.childNodes.length;++i)
	{
		if(Root.childNodes[i].tagName === "PREFERENCE-VARIABLE") // For each preference variable (node)
		{
			// Get its name
			var name = Root.childNodes[i].getElementsByTagName("VARIABLE-NAME")[0];
			if(name === undefined) { console.log("Cannot find VARIABLE-NAME on PREFERENCE-VARIABLE i" + i); continue; }
			name = name.textContent;

			// Make sure this isn't a duplicate named node
			if(NodeNamesToNodes[name] !== undefined) { console.log("PREFERENCE-VARIABLE '" + name + "' has a duplicate name"); continue; }

			// Get its possible values
			var values = Root.childNodes[i].getElementsByTagName("DOMAIN-VALUE");
			//if(values.length <= 1) { console.log("PREFERENCE-VARIABLE '" + name + "' has one or less DOMAIN-VALUEs"); continue; }
			var valueNames = [];
			for(var x=0;x<values.length;++x) { valueNames.push(values[x].textContent); }

			// Add the node
			NewGraphNodes.push({"name":name, "domain":valueNames, "preferences":[]});
			NodeNamesToNodes[name] = NewGraphNodes[NewGraphNodes.length-1]; // Also add it to this temporary array for easy node retrival when finding the links

			//						                domain indices       domain index of    node ref
			// prefereneces: [ { "id":"..." "order":[0,1,2,...],  "when":[i,                node] }      , {...} ]
			// Note: "when" is optional
		}
	}

	// Read preference statements
	for(var i=0;i<Root.childNodes.length;++i)
	{
		if(Root.childNodes[i].tagName === "PREFERENCE-STATEMENT") // For each preference statement....
		{
			// Get statement ID
			var statementID = Root.childNodes[i].getElementsByTagName("STATEMENT-ID")[0];
			if(statementID === undefined) { console.log("Cannot find STATEMENT-ID on PREFERENCE-STATEMENT i" + i); continue; }
			statementID = statementID.textContent;

			// Find the node that this preference is affecting
			var affectingNode = Root.childNodes[i].getElementsByTagName("PREFERENCE-VARIABLE")[0];
			if(affectingNode === undefined) { console.log("Cannot find PREFERENCE-VARIABLE on PREFERENCE-STATEMENT " + statementID); continue; }
			affectingNode = affectingNode.textContent;
			if(NodeNamesToNodes[affectingNode] === undefined) { console.log("Unknown affecting node '" + affectingNode + "' on PREFERENCE-STATEMENT " + statementID); continue; }
			affectingNode = NodeNamesToNodes[affectingNode];

			// Find the preference order
			var preferenceOrder = Root.childNodes[i].getElementsByTagName("PREFERENCE")[0];
			if(preferenceOrder === undefined) { console.log("Cannot find PREFERENCE on PREFERENCE-STATEMENT " + statementID); continue; }
			preferenceOrder = preferenceOrder.textContent.split(":");
			if(preferenceOrder.length < 1) { console.log("Invalid synax on PREFERENCE on PREFERENCE-STATEMENT " + statementID); continue; } // TODO: Can the preference not specifiy all of the domain?

			// Validate the preferences
			// Also convert them to indices
			var preferenceValid = true;
			for(var x=0;x<preferenceOrder.length;++x)
			{
				var index = affectingNode.domain.indexOf(preferenceOrder[x]);
				if(index < 0) { preferenceValid = false; break; }
				preferenceOrder[x] = index;
			}
			if(!preferenceValid) { console.log("Invalid PREFERENCE on PREFERENCE-STATEMENT " + statementID); continue; }

			// Create the preference node object
			var preference = {"id":statementID, "order":preferenceOrder};

			// Check when this preference applies
			// This also tells us where the links are
			// This part is optional; if it is not specified, the affecting node should be the top of the chain (no parents) TODO: Enforce that? Since another pref statement could wrongly change that
			var conditionParts = [];
			var condition = Root.childNodes[i].getElementsByTagName("CONDITION")[0];
			if(condition)
			{
				// There is a condition; split it by the equals sign to get [condition-causing node name, value]
				conditionParts = condition.textContent.split("=");
				if(conditionParts.length == 2)
				{
					var conditionCausingNode = NodeNamesToNodes[conditionParts[0]];
					if(conditionCausingNode !== undefined)
					{
						// Validate condition
						var conditionIndex = conditionCausingNode.domain.indexOf(conditionParts[1]);
						if(conditionIndex >= 0)
						{
							// Add condition to preference
							preference.when = [conditionIndex, conditionCausingNode];
						}
						else { console.log("Invalid CONDITION value on PREFERENCE-STATEMENT " + statementID); }
					}
					else { console.log("Invalid CONDITION node on PREFERENCE-STATEMENT " + statementID); }
				}
				else { console.log("Invalid synax on CONDITION on PREFERENCE-STATEMENT " + statementID); }
			}

			// Add the preference object to the node
			affectingNode.preferences.push(preference);
		}
	}

	return NewGraphNodes;
}

// Takes a d3cola nodes list and returns an XML string representing the graph
function GraphToXML(GraphNodes)
{
	var XmlString = "<?xml version='1.0' encoding='us-ascii'?>\n<PREFERENCE-SPECIFICATION>\n";

	// Output the preference variables (aka nodes)
	for(var i=0;i<GraphNodes.length;++i)
	{
		XmlString += "  <PREFERENCE-VARIABLE>\n";
		XmlString += "    <VARIABLE-NAME>" + GraphNodes[i].name + "</VARIABLE-NAME>\n";
		for(var j=0;j<GraphNodes[i].domain.length;++j)
			XmlString += "    <DOMAIN-VALUE>" + GraphNodes[i].domain[j] + "</DOMAIN-VALUE>\n";
		XmlString += "  </PREFERENCE-VARIABLE>\n";
	}

	// Output the preference statements (per node per statement)
	for(var i=0;i<GraphNodes.length;++i)
	{
		for(var j=0;j<GraphNodes[i].preferences.length;++j)
		{
			XmlString += "  <PREFERENCE-STATEMENT>\n";
			XmlString += "    <STATEMENT-ID>" + GraphNodes[i].preferences[j].id + "</STATEMENT-ID>\n";
			XmlString += "    <PREFERENCE-VARIABLE>" + GraphNodes[i].name + "</PREFERENCE-VARIABLE>\n";
			XmlString += "    <PREFERENCE>";
			for(var x=0;x<GraphNodes[i].preferences[j].order.length;++x) // List the preference order
				XmlString += (x === 0 ? "" : ":") + GraphNodes[i].domain[GraphNodes[i].preferences[j].order[x]];
			XmlString += "</PREFERENCE>\n";
			if(GraphNodes[i].preferences[j].when) // Optionally list when this preference statement applies
			{
				// <CONDITION>conditionCausingNode=(domain when[0] from conditionCausingNode)</CONDITION> 
				XmlString += "    <CONDITION>";
				XmlString += GraphNodes[i].preferences[j].when[1].name + "=";
				XmlString += GraphNodes[i].preferences[j].when[1].domain[GraphNodes[i].preferences[j].when[0]];
				XmlString += "</CONDITION>\n";
			}
			XmlString += "  </PREFERENCE-STATEMENT>\n";
		}
	}

	// Complete
	XmlString += "</PREFERENCE-SPECIFICATION>";
	return XmlString;
}




// Utility functions

// XML Parser
// http://stackoverflow.com/questions/649614/xml-parsing-of-a-variable-string-in-javascript/8412989#8412989
var parseXml;
if (typeof window.DOMParser != "undefined") {
	parseXml = function(xmlStr) {
		return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
	};
} else if (typeof window.ActiveXObject != "undefined" &&
	   new window.ActiveXObject("Microsoft.XMLDOM")) {
	parseXml = function(xmlStr) {
		var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
		xmlDoc.async = "false";
		xmlDoc.loadXML(xmlStr);
		return xmlDoc;
	};
} else {
	throw new Error("No XML parser found");
}

function isEmptyOrSpaces(str)
{
	if(typeof(str) === 'number')
		str = str.toString();

	if(typeof(str) !== 'string')
		return true;

	return !str || str.match(/^ *$/) !== null;
}
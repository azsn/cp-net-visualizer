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
	this.Parents = [];
	this.Children = [];
	this.Domain = [];
	this.CPT = []; // Multidimensional array. CPT[parent0-domain-index][parent1-domain-index][...][preference-order-index]
	this.CPTListCache = null; // Cached list of the this.CPT multidimensional array. Lists every end value of this.CPT. Set to null whenever this.CPT changes.

	// Sets this node's name
	// Optionally, if GraphNodes is specified, does not set name and returns false if the given name matches any existing node name
	// Returns false if the new name is empty (blank or only whitespace)
	this.SetName = function (Name)
	{
		// Make sure the new name isn't blank
		if(isEmptyOrSpaces(Name))
			return false;

		// Make sure the name isn't a duplicate
		// TODO

		// Set the name
		this.Name = Name;
		return true;
	}

	// Sets this node's domain
	this.SetDomain = function (Domain)
	{
		// Make sure domain has at least one item
		if(Domain.length <= 0)
			Domain = ["domain_item"];
		else
			Domain.sort();

		// Find new/removed/moved indices
		var DomainIndexChanges = [], AddedIndices = [];
		for(var i=0;i<this.Domain.length;++i)
			DomainIndexChanges[i] = Domain.indexOf(this.Domain[i]);
		
		if(this.Domain.length === Domain.length)
		{
			// The length of the old and new domain are the same, so assume that this is just a rename of domain items
			// Find a place for each old domain who's name probably changed
			// Not always correct, but it helps
			for(var i=0;i<DomainIndexChanges.length;++i)
			{
				if(DomainIndexChanges[i] < 0)
				{
					var foundIndex = -1;
					for(var j=0;j<Domain.length;++j)
					{
						var hasMoved = true;
						for(var k=0;k<DomainIndexChanges.length;++k)
						{
							if(DomainIndexChanges[k] === j)
							{
								hasMoved = false;
								break;
							}
						}

						if(hasMoved)
						{
							foundIndex = j;
							break;
						}
					}

					DomainIndexChanges[i] = foundIndex;
				}
			}
		}
		else
		{
			for(var i=0;i<Domain.length;++i)
				if(this.Domain.indexOf(Domain[i]) < 0)
					AddedIndices.push(i);
		}

		// Set the domain
		this.Domain = Domain;

		// Fix the preference orders for the new domain
		var CPTList = this.ListCPT();
		for(var i=0;i<CPTList.length;++i)
		{
			// Move old indices to the new ones
			for(var j=0;j<CPTList[i].preference.length;j+=2) // skip every other since they're the succeeds booleans
			{
				var newIndex = DomainIndexChanges[CPTList[i].preference[j]];
				if(newIndex < 0) // This domain item was deleted, remove it from the preference order
				{
					if(j === 0)
						CPTList[i].preference.splice(j, 2); // Remove the succeed boolean
					else if(j === CPTList[i].preference.length - 1)
						CPTList[i].preference.splice(j-1, 2);
					else if(CPTList[i].preference[j+1])
						CPTList[i].preference.splice(j, 2);
					else
						CPTList[i].preference.splice(j-1, 2);
					j-=2;
				}
				else
				{
					CPTList[i].preference[j] = newIndex;
				}
			}

			// Add new domain indices
			for(var j=0;j<AddedIndices.length;++j)
			{
				if(CPTList[i].preference.length > 0)
					CPTList[i].preference.push(0);
				CPTList[i].preference.push(AddedIndices[j]);
			}
		}
		this.CPTListCache = null;

		// Update child node CPTs
		for(var i=0;i<this.Children.length;++i)
		{
			// Get parent (This) index in child
			var thisIndexInChild = this.Children[i].Parents.indexOf(this);
			if(thisIndexInChild < 0) // Just making sure
				continue;

			// Iterate over every section of the CPT containg data for This
			// So, if This is the child's index 2 parent (3rd parent), this would iterate over every CPT[parent0-domain-index][parent1-domain-index]
			// Meaning that each CPTSection returned has (CPTSection.length == this.Domain.length) AFTER this iteration completes and the domains are updated
			IterateCPTLevel(this.Children[i].CPT, 0, thisIndexInChild, function (CPTSection)
			{
				// Shallow copy original
				var oldCPTSection = CPTSection.slice(0);

				// Move domain items from original to CPTSection, leave out removed domain items
				CPTSection.length = 0;
				for(var j=0;j<DomainIndexChanges.length;++j)
					if(DomainIndexChanges[j] >= 0)
						CPTSection[DomainIndexChanges[j]] = oldCPTSection[j];

				// Add in the new domain items
				for(var j=0;j<AddedIndices.length;++j)
					CPTSection[AddedIndices[j]] = CloneCPTArray(oldCPTSection[0]);
			});
			this.Children[i].CPTListCache = null;
		}
	}

	// Links this node to TargetNode and updates the TargetNode's CPT table
	// Returns "cycles not allowed" and does nothing if the link creates a cycle and cycles aren't allowed
	// Returns "too many parents" and does nothing if the link creates too many parent nodes to TargetNode
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
			return "too many parents";

		// Add the link
		this.Children.push(TargetNode);
		var ParentInsertIndex = BinaryInsert(TargetNode.Parents, this, function (A, B) { return (A.Name === B.Name) ? -1 : (A.Name > B.Name); });
		if(ParentInsertIndex < 0)
			false;

		// Check for cycles
		if(!AllowCycles && IsNodeCyclic(TargetNode))
		{
			TargetNode.Parents.splice(ParentInsertIndex, 1);
			this.Children.pop();
			return "cycles not allowed";
		}

		// Add to child's CPT
		var ThisDomainLength = this.Domain.length;
		IterateCPTLevel(TargetNode.CPT, 0, ParentInsertIndex, function (CPTSection)
		{
			// Takes each end node and makes it into another array where newarray[0]=the-original-end-node, newarray[1]=clone-of-original, newarray[2]=clone-of-original, ...
			var section = CPTSection.slice(0);
			CPTSection.length = 0;
			
			CPTSection.push(section);
			for(var i=0;i<ThisDomainLength-1;++i)
				CPTSection.push(CloneCPTArray(section));
		});
		TargetNode.CPTListCache = null;

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

		// Remove from child's CPT
		IterateCPTLevel(TargetNode.CPT, 0, ParentIndex, function (CPTSection)
		{
			// Opposite of what is done in LinkTo
			var section = CPTSection[0];
			CPTSection.length = 0;
			for(var i=0;i<section.length;++i)
				CPTSection[i] = section[i];
		});
		TargetNode.CPTListCache = null;
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
		var Children = [];
		var ChildCount = this.Children.length; // UnlinkFrom modifies the child count, so cache the variable
		for(var i=0;i<ChildCount;++i)
		{
			Children[i] = this.Children[0];
			this.UnlinkFrom(this.Children[0], true);
		}

		// Remove all incoming links
		var ParentCount = this.Parents.length;
		for(var i=0;i<ParentCount;++i)
			this.Parents[0].UnlinkFrom(this, true);

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
		this.CPTListCache = null;
	}

	// Returns the multidimensional CPT as a list where each end node in the CPT is a entry in the list entry of {condition:path-to-end-node, preference:end-node}
	this.ListCPT = function ()
	{
		if(this.CPTListCache)
			return this.CPTListCache;

		var NumParents = this.Parents.length;
		var ListRecurse = function (CPTSection, Dimension)
		{
			if(Dimension.length >= NumParents)
				return [{"condition":Dimension, "preference":CPTSection}];

			var List = [];
			for(var i=0;i<CPTSection.length;++i)
				List = List.concat(ListRecurse(CPTSection[i], Dimension.concat([i])));
			return List;
		}

		this.CPTListCache = ListRecurse(this.CPT, []);
		return this.CPTListCache;
	}

	this.SetPreference = function (Condition, Preference)
	{
		if(!Array.isArray(Condition) || !Array.isArray(Preference) || Condition.length != this.Parents.length)
			return;

		var PrevPref = this.CPT;
		for(var i=0;i<Condition.length;++i)
			PrevPref = PrevPref[Condition[i]];

		PrevPref.length = 0; // Clear existing preference
		for(var i=0;i<Preference.length;++i)
			PrevPref[i] = Preference[i];
	}

	this.GetPreference = function (Condition)
	{
		if(!Array.isArray(Condition) || Condition.length != this.Parents.length)
			return null;

		var PrevPref = this.CPT;
		for(var i=0;i<Condition.length;++i)
			PrevPref = PrevPref[Condition[i]];
		return PrevPref;
	}

	// Set default name and domain
	this.SetName(Name_); 
	this.SetDomain([]);
}

/*
Condition:
[parent1domainindex, parent2domainindex, ...]

Preference:
[domainindex, succeedsorequalto ? 1 : 0, domainindex, [1...], domainindex, ...]
if disabled, the domain index will be (-domainindex - 1)

A preference statement:
[condition, value]

*/

function DuplicatePreferenceStatement(PrefStatement)
{
	return {"condition":PrefStatement.condition.slice(0), "preference":PrefStatement.preference.slice(0)};
}
function CloneCPTArray(CPTSection)
{
	if(!Array.isArray(CPTSection))
		return CPTSection;
	var Cloned = [];
	for(var i=0;i<CPTSection.length;++i)
		Cloned.push(CloneCPTArray(CPTSection[i]));
	return Cloned;
}
function IterateCPTLevel(CPTSection, CurrentLevel, TargetLevel, Callback)
{
	if(CurrentLevel > TargetLevel || !Callback)
		return;
	if(CurrentLevel === TargetLevel)
		return Callback(CPTSection);
	for(var i=0;i<CPTSection.length;++i)
		IterateCPTLevel(CPTSection[i], CurrentLevel+1, TargetLevel, Callback);
}

function BinaryInsert(InsertArray, Value, Comparator, Start, End)
{
	if(InsertArray.length === 0)
	{
		InsertArray.push(Value);
		return 0;
	}

	Start = (typeof(Start) === 'undefined' ? 0 : Start);
	End = (typeof(End) === 'undefined' ? InsertArray.length-1 : End);
	Comparator = (typeof(Comparator) === 'function' ? Comparator : (function (A, B) { return (A == B) ? -1 : (A > B); }) ); // Return 1: >, 0: <, -1: ==
	var Middle = Start + Math.floor((End-Start)/2);
	
	if(Start > End)
		return -1;

	if(Comparator(Value, InsertArray[End]) != 0)
	{
		InsertArray.splice(End + 1, 0, Value);
		return End + 1;
	}
	if(Start == End || Comparator(Value, InsertArray[Start]) != 1)
	{
		InsertArray.splice(Start, 0, Value);
		return Start;
	}

	var Comparison = Comparator(Value, InsertArray[Middle]);
	
	if(Comparison == 1)
	{
		return BinaryInsert(InsertArray, Value, Comparator, Middle + 1, End);
	}
	else if(Comparison == 0)
	{
		return BinaryInsert(InsertArray, Value, Comparator, Start, Middle - 1);
	}
	else
	{
		InsertArray.splice(Middle, 0, Value);
		return Middle;
	}
}

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


// // Returns the Node's CPT as an array
	// // Do not pass any arguments to this function
	// this.ListCPT = function (CPTSection, Dimension)
	// {
	// 	if(typeof(CPTSection) === 'undefined')
	// 		CPTSection = this.CPT;
	// 	if(typeof(Dimension) === 'undefined')
	// 		Dimension = [];

	// 	if(this.Parents.length == 0)
	// 		return [];
	// 	if(Dimension.length >= this.Parents.length || !Array.isArray(CPTSection))
	// 		return {"condition":Dimension, "preference":CPTSection};

	// 	var List = [];
	// 	for(var i=0;i<CPTSection.length;++i)
	// 	{
	// 		var newList = this.ListCPT(CPTSection[i], Dimension.concat([i]));
	// 		if(newList.condition && newList.preference)
	// 			List.push(newList);
	// 		else
	// 			List = List.concat(newList);
	// 	}
	// 	return List;
	// }


// function Graph()
// {
// 	this.Nodes = [];

// 	// Adds a node to this graph
// 	// Recursively adds every node attached to the given node into this graph as well
// 	// Returns false and does not add the node if the node's name is blank or already exists in this graph
// 	this.AddNode = function(Node)
// 	{
// 		if(isEmptyOrSpaces(Node.Name)) // Can't add before setting a name
// 			return false;

// 		for(var i=0;i<this.Nodes.length;++i)
// 			if(this.Nodes.Name == Node.Name)
// 				return false;

// 		this.Nodes.push(Node);
// 		return true;
// 	}

// 	// Removes the given node from this graph and destroys the node
// 	// Does nothing if the given node is not in this graph
// 	this.DestroyNode = function(Node)
// 	{
// 		var NodeIndex = this.Nodes.indexOf(Node);
// 		if(NodeIndex >= 0)
// 		{
// 			this.Nodes.splice(NodeIndex, 1);
// 			Node.Destroy();
// 		}
// 	}

// 	// Sets a node's name
// 	// Returns false and does nothing if the new name matches the name of an existing node in this graph
// 	// Node does not have to be in this Graph
// 	this.SetName = function(Node, Name)
// 	{
// 		if(isEmptyOrSpaces(Name))
// 			return false;

// 		for(var i=0;i<GraphNodes.length;++i)
// 			if(GraphNodes[i].Name === Name)
// 				return false;

// 		Node.Name = Name;
// 		return true;
// 	}
// }

// function Graph()
// {
// 	this.Nodes = [];
// 	this.AllowCycles = false;
// 	this.MaxParents = 5;

// 	// Creates a new node in the graph with the given name
// 	// Does not add a node and returns null if Name is not available
// 	this.AddNewNode = function (Name)
// 	{
// 		var N = new Node(this, Name);
// 		if(N.Name != Name)
// 			return null;
// 		this.Nodes.push(N);
// 		return N;
// 	}

// 	// Removes the given node (either a node object or its name) from the graph
// 	this.RemoveNode = function (Node)
// 	{
// 		// Convert node name to node object (if it's given as a name)
// 		if(typeof(Node) === 'string')
// 			Node = this.GetNodeByName(Node);
// 		if(!Node)
// 			return;

// 		// Remove all outgoing links from this node
// 		var Children = [];
// 		var ChildCount = Node.Children.length; // UnlinkFrom modifies the child count, so cache the variable
// 		for(var i=0;i<ChildCount;++i)
// 		{
// 			Children.push(Node.Children[0]);
// 			this.UnlinkNodes(Node, Node.Children[0]);
// 		}

// 		// Remove all incoming links
// 		var ParentCount = this.Parents.length;
// 		for(var i=0;i<ParentCount;++i)
// 			this.UnlinkNodes(Node.Parents[0], Node);

// 		// TODO: Update the child nodes' CPTs
// 		//for(var i=0;i<Children.length;++i)
// 		//	Children[i].GenerateCPT();

// 		// Remove from graph
// 		var NodeIndex = GraphNodes.indexOf(this);
// 		if(NodeIndex >= 0)
// 			GraphNodes.splice(NodeIndex, 1);

// 		// Delete data
// 		Node.Domain = [];
// 		Node.Parents = [];
// 		Node.Children = [];
// 		Node.CPT = [];
// 	}

// 	// Directionally links from SourceNode to TargetNode
// 	this.LinkNodes = function (SourceNode, TargetNode)
// 	{
// 		// Validate nodes
// 		if(!SourceNode || !TargetNode)
// 			return false;

// 		// Check if they're already linked
// 		if(SourceNode.AreNodesLinked(TargetNode))
// 			return true;

// 		// Check for too many in-nodes
// 		if(TargetNode.Parents.length + 1 > this.MaxParents)
// 			return "too_many_parents";

// 		// Add the link
// 		TargetNode.Parents.push(SourceNode);
// 		SourceNode.Children.push(TargetNode);

// 		// Check for cycles
// 		if(!this.AllowCycles && IsNodeCyclic(TargetNode))
// 		{
// 			TargetNode.Parents.pop();
// 			SourceNode.Children.pop();
// 			return "cycles_not_allowed";
// 		}

// 		// TODO: Update the TargetNode's CPT

// 		return true;
// 	}

// 	// Directionally unlinks from SourceNode to TargetNode
// 	this.UnlinkNodes = function (SourceNode, TargetNode)
// 	{
// 		// Validate nodes
// 		if(!SourceNode || !TargetNode)
// 			return;

// 		// Make sure that TargetNode is a child of SourceNode
// 		var ParentIndex = TargetNode.Parents.indexOf(SourceNode);
// 		if(ParentIndex < 0)
// 			return;

// 		// Remove the link
// 		TargetNode.Parents.splice(ParentIndex, 1);

// 		var ChildIndex = SourceNode.Children.indexOf(TargetNode);
// 		SourceNode.Children.splice(ChildIndex, 1);

// 		// TODO: Update the TargetNode's CPT
// 	}

// 	// Returns true if SourceNode is directionally linked to TargetNode
// 	this.AreNodesLinked = function (SourceNode, TargetNode)
// 	{
// 		if(!SourceNode || !TargetNode)
// 			return false;
// 		return TargetNode.Parents.indexOf(SourceNode) >= 0;
// 	}

// 	// Returns true if the given name is available for use in the graph
// 	this.CheckNameAvailable = function (Name)
// 	{
// 		// Check for invalid names
// 		if(isEmptyOrSpaces(Name))
// 			return false;

// 		// Check for duplicate names
// 		for(var i=0;i<this.Nodes.length;++i)
// 			if(this.Nodes[i].Name == Name)
// 				return false;

// 		return true;
// 	}

// 	// Returns a node object from the given name
// 	// Returns null if there is no such node
// 	this.GetNodeByName = function (Name)
// 	{
// 		for(var i=0;i<this.Nodes.length;++i)
// 			if(this.Nodes[i].Name == Name)
// 				return this.Nodes[i];
// 		return null;
// 	}

// 	// Sets the max number of parents for any node
// 	// Returns false and does nothing if this cannot be set (if there is already a node with more parents than trying to be set)
// 	this.SetMaxParentNodes = function (MaxParents)
// 	{
// 		// Check if any node already has more parents than MaxParents
// 		for(var i=0;i<this.Nodes.length;++i)
// 			if(df)
// 		this.MaxParents = MaxParents;
// 	}

// 	// Enables or disables cycles
// 	// Returns false and does nothing if there is already a cycle in the graph
// 	this.SetAllowsCycles = function (AllowsCycles)
// 	{

// 	}
// }



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
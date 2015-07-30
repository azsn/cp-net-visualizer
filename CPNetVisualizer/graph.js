var AllowCycles = false; // Can be set by GUI
var MaxInNodes = 5; // Can be set by GUI

////////////////////////////////////////////////////////////////////////////////////////////////
// NODE CLASS
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
		
		// Ignore this. It's just to make setting the domain a little easier on the user, it is completely optional
		// The 'else' part of this if statement is not optional, however. If this 'if' is removed, keep what is in the 'else' (but not still within the if statement)
		if(this.Domain.length === Domain.length)
		{
			// The length of the old and new domain are the same, so assume that this is just a rename of domain items
			// Find a place for each old domain who's name probably changed
			// Not always correct, but it helps
			for(var i=0;i<DomainIndexChanges.length;++i)
			{
				// Does it not have a new domain item to go to?
				if(DomainIndexChanges[i] < 0)
				{
					// Search the new domain items for one to go to 
					var foundIndex = -1;
					for(var j=0;j<Domain.length;++j)
					{
						// Check if this new one has nothing from the old domain pointing to it
						var hasMoved = true;
						for(var k=0;k<DomainIndexChanges.length;++k)
						{
							if(DomainIndexChanges[k] === j)
							{
								hasMoved = false;
								break;
							}
						}

						// It doesn't, so the old domain can point to this one
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
					// Remove the succeed boolean where
					// a >= b >= c   ->   a >= c
					// a >= b >  c   ->   a >  c
					// a >  b >= c   ->   a >  c
					// a >  b >  c   ->   a >  c
					if(j === 0)
						CPTList[i].preference.splice(j, 2);
					else if(j === CPTList[i].preference.length - 1)
						CPTList[i].preference.splice(j-1, 2);
					else if(CPTList[i].preference[j+1])
						CPTList[i].preference.splice(j, 2);
					else
						CPTList[i].preference.splice(j-1, 2);
					j-=2;
				}
				else // Wasn't deleted, just move it
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
		if(!AllowCycles && this.IsCyclic())
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

	// Preference getter/setter
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

	// Returns true if the given StartingNode is part of a cycle
	// Does NOT detect if a cycle can be reached from this node; only if THIS node is PART OF a cycle
	this.IsCyclic = function()
	{
		var IsCyclicHelper = function (StartingNode, CurrentNode, VisitedNodes)
		{
			// If we've reached the StartingNode, there is a cycle
			if(StartingNode === CurrentNode)
				return true;

			// Set starting values
			if(!CurrentNode)
				CurrentNode = StartingNode; // If this is the first iteration, make the StartingNode current

			// Exit if this node has already been visited
			if(VisitedNodes.indexOf(CurrentNode) >= 0)
				return false;

			// Add this node to the visited nodes list
			VisitedNodes.push(CurrentNode);

			// Recurse on all parents
			for(var i=0;i<CurrentNode.Parents.length;++i)
				if(IsCyclicHelper(StartingNode, CurrentNode.Parents[i], VisitedNodes)) // If a cycle was found, return true immediately
					return true;

			return false;
		}

		return IsCyclicHelper(this, null, [])
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



////////////////////////////////////////////////////////////////////////////////////////////////
// UTILITY FUNCTIONS
////////////////////////////////////////////////////////////////////////////////////////////////

// Duplicates a preference statement (the kind returned by Node.ListCPT())
function DuplicatePreferenceStatement(PrefStatement)
{
	return {"condition":PrefStatement.condition.slice(0), "preference":PrefStatement.preference.slice(0)};
}

// Makes a deep clone of a multidimensional CPT array
// Clones the preferences too, so any modification in the clone does not affect the original
function CloneCPTArray(CPTSection)
{
	if(!Array.isArray(CPTSection))
		return CPTSection;
	var Cloned = [];
	for(var i=0;i<CPTSection.length;++i)
		Cloned.push(CloneCPTArray(CPTSection[i]));
	return Cloned;
}

// Iterates over the nodes at a specific level in a multidimensional CPT array
// For example, in this CPT array:
//       A        row 0
//      / \
//    B     C     row 1
//   /|\   /|\
//  a b c d e f   row 2 (preferences row, not actual nodes, but technically still iterable)
// Calling IterateCPTLevel(A, 0, 1, Callback) would call Callback(B) and Callback(C)
// Also, calling IterateCPTLevel(A, 0, 2, Callback) is equal to calling IterateCPTLevel(B, 0, 1, Callback) plus IterateCPTLevel(C, 0, 1, Callack)
function IterateCPTLevel(CPTSection, CurrentLevel, TargetLevel, Callback)
{
	if(CurrentLevel > TargetLevel || !Callback)
		return;
	if(CurrentLevel === TargetLevel)
		return Callback(CPTSection);
	for(var i=0;i<CPTSection.length;++i)
		IterateCPTLevel(CPTSection[i], CurrentLevel+1, TargetLevel, Callback);
}

// Inserts Value into a sorted array InsertArray at the correct position to keep the array sorted.
// Use a custom comparator if Value can not be compared with the standard ==, >, and < operators.
// The comparator function should return true 1 if A > B, 0 if A < B, and -1 if A == B.
// Mostly copied from http://machinesaredigging.com/2014/04/27/binary-insert-how-to-keep-an-array-sorted-as-you-insert-data-in-it/, but changed to support duplicates (not necessary, but whatever)
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

// Returns true if the graph contains any cycles anywhere, false otherwise
function DoesGraphHaveCycle(GraphNodes)
{
	// Run IsNodeCyclic on every node in the graph
	for(var i=0;i<GraphNodes.length;++i)
		if(GraphNodes[i].IsCyclic())
			return true;
	return false;
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
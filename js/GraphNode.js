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
	this.DegeneracyCache = []; // Cached return value of IsParentDegenerate for each parent. Cleared when this.CPT changes (including preference changes).
	this.HighlightedCPTRow = null; // For GUI to highlight a specific important row. Not set internally. Set to a CPT condition or null.
	
	// Sets this node's name
	// Optionally, if GraphNodes is specified, does not set name and returns false if the given name matches any existing node name
	// Returns false if the new name is empty (blank or only whitespace)
	this.SetName = function (Name, GraphNodes)
	{
		// Make sure the new name isn't blank
		if(isEmptyOrSpaces(Name))
			return false;

		if(GraphNodes)
		{
			// Make sure the name isn't a duplicate
			for(var i=0;i<GraphNodes.length;++i)
				if(GraphNodes[i].Name == Name)
					return false;
		}
		
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
		
		// Remove duplicates and sort the array
		for(var i=0;i<Domain.length;++i)
			Domain[i] = Domain[i].trim();
		Domain.sort();
		Domain = Domain.filter(function(item, pos) {
		    return Domain.indexOf(item) == pos;
		});

		// Find new/removed/moved indices
		var DomainIndexChanges = [], AddedIndices = [];
		for(var i=0;i<this.Domain.length;++i)
			DomainIndexChanges[i] = Domain.indexOf(this.Domain[i]);

		// Ignore this. It's just to make setting the domain a little easier on the user, it is completely optional
		// The 'else' part of this if statement is not optional, however. If this 'if' is removed, keep what is in the 'else' (but not still within the if statement)
		if(this.Domain.length === Domain.length)
		{
			// Check for equality
			var same = true;
			for(var i=0;i<DomainIndexChanges.length;++i) { if(DomainIndexChanges[i] != i)	{ same = false; break; } }
			if(same) return;
			
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

		// Everything above is just validating the new Domain array. The following code actually changes the domain

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
			this.Children[i].DegeneracyCache = [];
		}
	}

	// Links this node to TargetNode and updates the TargetNode's CPT table
	// AllowCycles defaults to false
	// MaxInNodes is the limit to how many parents a node can have (defaults to unlimited)
	// Returns "cycles not allowed" and does nothing if the link creates a cycle and cycles aren't allowed
	// Returns "too many parents" and does nothing if the link creates too many parent nodes to TargetNode
	// Returns true on success
	this.LinkTo = function (TargetNode, AllowCycles, MaxInNodes)
	{
		if(AllowCycles === 'undefined')
			AllowCycles = false;
			
		// Validate nodes
		if(!TargetNode)
			return false;

		// Check if they're already linked
		if(this.IsLinkedTo(TargetNode))
			return true;

		// Check for too many in-nodes
		if(MaxInNodes !== 'undefined' && TargetNode.Parents.length + 1 > MaxInNodes)
			return "too many parents";

		// Add the link
		this.Children.push(TargetNode);
		var ParentInsertIndex = BinaryInsert(TargetNode.Parents, this, function (A, B) { return (A.Name === B.Name) ? -1 : (A.Name > B.Name); });
		if(ParentInsertIndex < 0)
			return false;

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
		TargetNode.DegeneracyCache = [];
		
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
		TargetNode.DegeneracyCache = [];
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
			if(GraphNodes[i].Name == this.Name)
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
		this.DegeneracyCache = [];
	}

	// Returns the multidimensional CPT as a list where each end node in the CPT is a entry in the list entry of {condition:path-to-end-node, preference:end-node}
	// Pass true to ClearCache to ignore the cached list, if available, and regenerate the list (automatically done if the CPT changes)
	this.ListCPT = function (ClearCache)
	{
		if(!ClearCache && this.CPTListCache)
			return this.CPTListCache;

		var NumParents = this.Parents.length;
		var FoundHighlight = false;
		var self = this;
		var ListRecurse = function (CPTSection, Dimension)
		{
			if(Dimension.length >= NumParents)
			{
				var highlight = false;
				if(self.HighlightedCPTRow && self.HighlightedCPTRow.constructor === Array && !FoundHighlight)
				{
					highlight = ShallowCompareArrays(self.HighlightedCPTRow, Dimension);
					if(highlight) FoundHighlight = true;
				}
				
				return [{"condition":Dimension, "preference":CPTSection, "highlight":highlight}];
			}
			
			var List = [];
			for(var i=0;i<CPTSection.length;++i)
				List = List.concat(ListRecurse(CPTSection[i], Dimension.concat([i])));
			return List;
		}

		this.CPTListCache = ListRecurse(this.CPT, []);
		return this.CPTListCache;
	}

	// Returns the number of CPT entries in this node (aka the number of entries in the array returned by this.ListCPT), with minimal computation
	this.GetCPTListSize = function ()
	{
		var CPTListSize = 1;
		for(var i=0;i<this.Parents.length;++i)
			CPTListSize *= this.Parents[i].Domain.length;
		return CPTListSize;
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
			
		this.UpdatePreferences();
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
	
	// Call this whenever a preference changes. Automatically called from this.SetPreference, however not called when preferences
	// are changed manually (such as editing the list returned from this.ListCPT())
	this.UpdatePreferences = function()
	{
		this.DegeneracyCache = [];
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

		return IsCyclicHelper(this, null, []);
	}

	// Returns true if this node's given parent is degenerate (has no effect on the preferences of this node)
	// A node can only be degenerate relative to the child node; a degenerate parent of this node might not be degenerate for another of its child nodes
	// Returns 0 if not degenerate, 1 if degenerate, 2 if possibly degenerate, -1 if an error, -2 if over cap
	// Pass true to ClearCache to clear the cache of the return of this function, and recalculate degeneracy (automatically done if the CPT changes)
	// Pass a maximum number of CPT list entries to handle without aborting to SizeCap. If this.GetCPTListSize() > SizeCap, then this will return the cached value or -2
	this.IsParentDegenerate = function(ParentToTestIndex, SizeCap, ClearCache)
	{
		if(!ClearCache && typeof(this.DegeneracyCache[ParentToTestIndex]) === 'number')
			return this.DegeneracyCache[ParentToTestIndex];
			
		// Method: For every combination of domains in other parent nodes - excluding the given testing parent - test whether all the domains of the testing parent are the same
		// So for 3 parents, each 3 domain, so this.CPT[0-2][0-2][0-2], testing 2nd parent, test whether:
		//    0,0,0
		//    0,1,0
		//    0,2,0
		// are equal, then test it for 1,0,0  1,1,0  1,2,0  etc... (every combination of other nodes' domains)
		
		var PossibleCombinations = this.GetCPTListSize();
		if(PossibleCombinations == 1)
		{
			this.DegeneracyCache[ParentToTestIndex] = 1;
			return 1;
		}
		else if(typeof(SizeCap) === 'number' && PossibleCombinations > SizeCap)
		{
			// Already would have returned a cache if it exists, so just return error -2 now
			return -2;
		}
		
		var PrevPref = null;
		for(var i=0;i<PossibleCombinations;++i)
		{
			// Get the condition from the combination index
			var condition = [];
			var divisor = this.Parents[ParentToTestIndex].Domain.length;
			for(var j=0;j<this.Parents.length;++j)
			{
				if(j==ParentToTestIndex)
				{
					condition[j] = i % this.Parents[ParentToTestIndex].Domain.length;
				}
				else
				{
					condition[j] = Math.floor(i / divisor) % this.Parents[j].Domain.length;
					divisor *= this.Parents[j].Domain.length;
				}
			}
			
			// Get the preference from the condition
			var pref = this.GetPreference(condition);
			
			// Reset PrevPref if this is the beginning of a new cycle on ParentToTestIndex
			if(condition[ParentToTestIndex] == 0)
			{
				PrevPref = pref;
			}
			// Otherwise, compare this pref to the previous two
			else
			{
				if(pref.length != PrevPref.length)
				{
					this.DegeneracyCache[ParentToTestIndex] = undefined;
					return -1; // This shouldn't happen...
				}
				
				var equal = true;
				for(var x=0;x<pref.length;++x)
				{
					if(pref[x] != PrevPref[x])
					{
						equal = false;
						break;
					}
				}
				
				if(!equal)
				{
					this.DegeneracyCache[ParentToTestIndex] = 0;
					return 0; // Not degenerate in parent!
				}
			}
		}
		
		this.DegeneracyCache[ParentToTestIndex] = 1;
		return 1;
	}
	
	// Uses HTML and SVG tags to shorten domain names
	this.GetShortenedDomain = function()
	{
		// Special case for boolean variables
		if(this.Domain.length == 2)
		{
			if((this.Domain[0].toLowerCase() == "yes" && this.Domain[1].toLowerCase() == "no") ||
				(this.Domain[0].toLowerCase() == "no" && this.Domain[1].toLowerCase() == "yes") ||
				(this.Domain[0].toLowerCase() == "true" && this.Domain[1].toLowerCase() == "false") ||
				(this.Domain[0].toLowerCase() == "false" && this.Domain[1].toLowerCase() == "true"))
			{
				var domain = [this.Name[0].toUpperCase(), this.Name[0].toUpperCase() + "&#773;"];
				return {html: domain, svg: domain};
			}
		}
		
		var SHORTENED_LENGTH = 1;
		
		var Shortened = [];
		for(var i=0;i<this.Domain.length;++i)
		{
			Shortened[i] = this.Domain[i].substring(0, SHORTENED_LENGTH);
			Shortened[i] = Shortened[i][0].toUpperCase() + Shortened[i].substring(1);
		}
		
		var FinalHTML = [];
		var FinalSVG = [];
		
		for(var i=0;i<Shortened.length;++i)
		{
			if(typeof FinalHTML[i] !== 'undefined')
				continue;
				
			var found = false;
			for(var j=i+1;j<Shortened.length;++j)
			{
				if(Shortened[i]==Shortened[j])
				{
					found = true;
					break;
				}
			}
			
			if(found)
			{
				var count = 0;
				for(var j=i;j<Shortened.length;++j)
				{
					if(Shortened[i]==Shortened[j])
					{
						FinalHTML[j] = Shortened[j] + "<sub>"+count+"</sub>";
						FinalSVG[j] = Shortened[j] + "<tspan baseline-shift='sub'>"+count+"</tspan>";
						count++;
					}
				}
			}
			else
			{
				FinalHTML[i] = Shortened[i];
				FinalSVG[i] = Shortened[i];
			}
		}
		
		return {html: FinalHTML, svg: FinalSVG};
	}
	
	// this.GetConditionString = function(condition)
	// {
	// 	var conditionStr = "";
	// 	for(var j=0;j<cpList[i].condition.length;++j)
	// 		conditionStr += String.fromCharCode(97 + j) + (cpList[i].condition[j]+1);
	// }

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

function getAllIndexes(arr, val) {
	//http://stackoverflow.com/questions/20798477/how-to-find-index-of-all-occurrences-of-an-element-in-array
    var indexes = [], i = -1;
    while ((i = arr.indexOf(val, i+1)) != -1){
        indexes.push(i);
    }
    return indexes;
}

function ShallowCompareArrays(a, b)
{
	if(a.length != b.length)
		return false;
		
	for(var i=0;i<a.length;++i)
		if(a[i] != b[i])
			return false;
			
	return true;
}

// Duplicates a preference statement (the kind returned by Node.ListCPT())
function DuplicatePreferenceStatement(PrefStatement)
{
	return {"condition":PrefStatement.condition.slice(0), "preference":PrefStatement.preference.slice(0), "highlight":PrefStatement.highlight};
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

// Takes an XML string and converts it into a graph Nodes nodes list
// Returns null if there is no XML or it is invalid
// Returns {nodes:GraphNodes, errors:array-of-errors}
function XMLToGraph(XmlString)
{
	// Validate the XML string
	if(isEmptyOrSpaces(XmlString))
		return null;

	var Root = parseXml(XmlString); // Parse the XML string
	if(!Root)
		return null;

	if(!Root.childNodes || Root.childNodes.length <= 0)
		return null;
	Root = Root.getElementsByTagName("PREFERENCE-SPECIFICATION")[0];
	if(!Root || !Root.childNodes || Root.childNodes.length <= 0)
		return null;

	// Vars
	var GraphNodes = [];
	var Errors = [];
	var NodeNamesToNodes = [];

	// Read the preferences nodes
	for(var i=0;i<Root.childNodes.length;++i)
	{
		// For each preference variable (node)
		if(Root.childNodes[i].tagName !== "PREFERENCE-VARIABLE")
			continue;

			// Get its name
			var name = Root.childNodes[i].getElementsByTagName("VARIABLE-NAME")[0];
			if(name === undefined) { Errors.push("Cannot find VARIABLE-NAME on PREFERENCE-VARIABLE i" + i); continue; }
			name = name.textContent;

			// Make sure this isn't a duplicate named node
			if(NodeNamesToNodes[name] !== undefined) { Errors.push("PREFERENCE-VARIABLE '" + name + "' has a duplicate name"); continue; }

			// Get its possible domain values
			var domainvalues = Root.childNodes[i].getElementsByTagName("DOMAIN-VALUE");
			if(domainvalues.length < 1) { Errors.push("PREFERENCE-VARIABLE '" + name + "' has no DOMAIN-VALUEs"); continue; }
			var valueNames = [];
			for(var x=0;x<domainvalues.length;++x) { valueNames.push(domainvalues[x].textContent); }

			// Add the node
			var node = new Node(name);
			node.SetDomain(valueNames);
			NodeNamesToNodes[name] = node;
			GraphNodes.push(node);
	}

	// Read preference statements
readPreferenceStatementsLoop: // Loop label
	for(var i=0;i<Root.childNodes.length;++i)
	{
		// For each preference statement
		if(Root.childNodes[i].tagName !== "PREFERENCE-STATEMENT")
			continue;

		// Get statement ID
		var statementID = Root.childNodes[i].getElementsByTagName("STATEMENT-ID")[0];
		statementID = (statementID === undefined ? "unknown" : statementID.textContent);

		// Find the node that this preference is affecting
		var affectingNode = Root.childNodes[i].getElementsByTagName("PREFERENCE-VARIABLE")[0];
		if(affectingNode === undefined) { Errors.push("Cannot find PREFERENCE-VARIABLE on PREFERENCE-STATEMENT " + statementID); continue; }
		affectingNode = affectingNode.textContent;
		if(NodeNamesToNodes[affectingNode] === undefined) { Errors.push("Unknown affecting node '" + affectingNode + "' on PREFERENCE-STATEMENT " + statementID); continue; }
		affectingNode = NodeNamesToNodes[affectingNode];

		// Get the preference orders
		var preferenceOrders = Root.childNodes[i].getElementsByTagName("PREFERENCE");
		if(preferenceOrders.length < 1) { Errors.push("PREFERENCE-STATEMENT " + statementID + " does not specify any preference"); continue; }

		// Combine orders into one
		var preference = [];
		for(var j=0;j<preferenceOrders.length;++j)
		{
			var partialOrder = preferenceOrders[j].textContent.split(":");
			if(partialOrder.length == 1)
			{
				if(j != 0 || preferenceOrders.length != 1) { Errors.push("PREFERENCE-STATEMENT " + statementID + " has an invalid single-domain preference"); continue readPreferenceStatementsLoop; }
				preference = [partialOrder[0]];
				break;
			}
			else if(partialOrder.length == 2)
			{
				if(j == 0)
				{
					preference.push(partialOrder[0], 0, partialOrder[1]);
				}
				else
				{
					if(partialOrder[0] != preference[preference.length-1]) { Errors.push("PREFERENCE-STATEMENT " + statementID + " has an invalid preference order"); continue readPreferenceStatementsLoop; }
					preference.push(0, partialOrder[1]);
				}
			}
			else { Errors.push("Invalid syntax on PREFERENCE " + j + " on PREFERENCE-STATEMENT " + statementID); continue readPreferenceStatementsLoop; }
		}

		// Convert the preference to domain indices
		for(var j=0;j<preference.length;j+=2)
		{
			var index = affectingNode.Domain.indexOf(preference[j]);
			if(index < 0) { Errors.push("PREFERENCE-STATEMENT " + statementID + " has an unknown preference value '" + preference[j] + "'"); continue readPreferenceStatementsLoop; }
			preference[j] = index;
		}

		// Get the condition
		var condition = [];
		var conditions = Root.childNodes[i].getElementsByTagName("CONDITION");
		for(var j=0;j<conditions.length;++j)
		{
			// There is a condition; split it by the equals sign to get [condition-causing node name, value]
			var conditionParts = conditions[j].textContent.split("=");
			if(conditionParts.length != 2) { Errors.push("Invalid syntax on CONDITION " + j + " on PREFERENCE-STATEMENT " + statementID); continue readPreferenceStatementsLoop; }

			// Get the causing node
			var conditionCausingNode = NodeNamesToNodes[conditionParts[0]];
			if(conditionCausingNode === undefined) { Errors.push("Invalid node on CONDITION " + j + " on PREFERENCE-STATEMENT " + statementID); continue readPreferenceStatementsLoop; }

			// Validate condition
			var conditionIndex = conditionCausingNode.Domain.indexOf(conditionParts[1]);
			if(conditionIndex < 0) { Errors.push("Invalid value on CONDITION " + j + " on PREFERENCE-STATEMENT " + statementID); continue readPreferenceStatementsLoop; }

			// Add the condition to the node
			var linkStatus = conditionCausingNode.LinkTo(affectingNode, true);
			if(linkStatus !== true) { Errors.push("Unlinkable node on CONDITION " + j + " on PREFERENCE-STATEMENT " + statementID + "because: " + linkStatus); continue readPreferenceStatementsLoop; }
			condition[affectingNode.Parents.indexOf(conditionCausingNode)] = conditionIndex;
		}

		if(condition.length != affectingNode.Parents.length) { Errors.push("Unknown error building condition on PREFERENCE-STATEMENT " + statementID); continue; }

		// Set the preference on the affecting node
		affectingNode.SetPreference(condition, preference);
	}

	return {nodes:GraphNodes, errors:Errors};
}

// Takes a list of Nodes and returns an XML string representing the graph
function GraphToXML(GraphNodes)
{
	var XmlString = "<?xml version='1.0' encoding='us-ascii'?>\n<PREFERENCE-SPECIFICATION>\n";

	// Output the preference variables (aka nodes)
	for(var i=0;i<GraphNodes.length;++i)
	{
		XmlString += "  <PREFERENCE-VARIABLE>\n";
		XmlString += "    <VARIABLE-NAME>" + GraphNodes[i].Name + "</VARIABLE-NAME>\n";
		for(var j=0;j<GraphNodes[i].Domain.length;++j)
			XmlString += "    <DOMAIN-VALUE>" + GraphNodes[i].Domain[j] + "</DOMAIN-VALUE>\n";
		XmlString += "  </PREFERENCE-VARIABLE>\n";
	}

	// Output the preference statements (per node per statement)
	for(var i=0;i<GraphNodes.length;++i)
	{
		var cplist = GraphNodes[i].ListCPT();
		for(var j=0;j<cplist.length;++j)
		{
			XmlString += "  <PREFERENCE-STATEMENT>\n";
			XmlString += "    <STATEMENT-ID>v" + i + "_p" + j + "</STATEMENT-ID>\n";
			XmlString += "    <PREFERENCE-VARIABLE>" + GraphNodes[i].Name + "</PREFERENCE-VARIABLE>\n";
			for(var k=0;k<cplist[j].condition.length;++k)
				XmlString += "    <CONDITION>" + GraphNodes[i].Parents[k].Name + "=" + GraphNodes[i].Parents[k].Domain[cplist[j].condition[k]] + "</CONDITION>\n";
			if(GraphNodes[i].Domain.length == 1)
			{
				XmlString += "    <PREFERENCE>" + GraphNodes[i].Domain[0] + "</PREFERENCE>\n";
			}
			else
			{
				for(var k=0;k<cplist[j].preference.length-1;k+=2) // +2 since every other index is a succeeds/succeeds-or-equal-to boolean
					XmlString += "    <PREFERENCE>" + GraphNodes[i].Domain[cplist[j].preference[k]] + ":" + GraphNodes[i].Domain[cplist[j].preference[k+2]] + "</PREFERENCE>\n";
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

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

var NodeNameDisplay = document.getElementById("node-name-display");
var NodeNameInput = document.getElementById("node-name-input");

var DomainListTextarea = document.getElementById("domain-list-textarea");
var ParentsListTable = document.getElementById("parents-list-table");
var ManualDetectDegeneracyButton = document.getElementById("manual-detect-degenaracy-button"); // Only shown with large CPTs
var CPTTable = document.getElementById("cpt-table");

function NodeNameInputChanged() // set to oninput; called on every character typed
{
	if(!Graph.Modifiable || !Graph.GetSelectedNode())
		return;

	var Value = NodeNameInput.value;
	Graph.GetSelectedNode().SetName(NodeNameInput.value, Graph.Nodes);
	Graph.Update();
	NodeNameInput.value = Value; // So that the user can temporarily type unallowed names into the textfield (such as erasing the whole field before entering a name)
}

function DomainInputChanged() // set to onchange; only called when user is finished changing the domain
{
	if(!Graph.Modifiable || !Graph.GetSelectedNode())
		return;

	Graph.GetSelectedNode().SetDomain(DomainListTextarea.value.split("\n").filter(function(el) {
		return !isEmptyOrSpaces(el);
	}));
	Graph.Update();
}

function AddParentNodeButtonClicked()
{
	if(!Graph.Modifiable || !Graph.GetSelectedNode())
		return;

	var Dropdown = document.getElementById("addparent-dynamic-dropdown");
	if(!Dropdown)
		return;

	for(var i=0;i<Graph.Nodes.length;++i)
	{
		if(Graph.Nodes[i].Name == Dropdown.value) // Use == instead of === because DropDown.value is weird
		{
			if(!Graph.LinkNodes(Graph.Nodes[i], Graph.GetSelectedNode()))
				return;
			break;
		}
	}

	Graph.Update();
}

function RemoveParentNodeButtonClicked(ParentIndex)
{
	if(!Graph.Modifiable || !Graph.GetSelectedNode() || ParentIndex >= Graph.GetSelectedNode().Parents.length)
		return;

	Graph.GetSelectedNode().Parents[ParentIndex].UnlinkFrom(Graph.GetSelectedNode());
	Graph.Update();
}

function SelectParentItemClicked(ParentIndex)
{
	if(!Graph.Modifiable || !Graph.GetSelectedNode() || ParentIndex >= Graph.GetSelectedNode().Parents.length)
		return;
	Graph.SelectNode(Graph.GetSelectedNode().Parents[ParentIndex]);
}

function CPTListItemClicked(CPTListIndex, PreferenceIndex, ToggleDisable)
{
	if(!Graph.Modifiable || !Graph.GetSelectedNode())
		return;

	// Get the preference that was clicked
	var CPTList = Graph.GetSelectedNode().ListCPT();
	var Preference = CPTList[CPTListIndex].preference;

	// If PreferenceIndex is odd, then it is a succeeds indicator, so toggle it
	if(PreferenceIndex % 2 === 1)
	{
		Preference[PreferenceIndex] = !Preference[PreferenceIndex]; // Toggle
		Graph.GetSelectedNode().UpdatePreferences();
		Graph.Update();
		return;
	}

	// If ToggleDisable, just toggle the disabled state on the item
	if(ToggleDisable)
	{
		Preference[PreferenceIndex] = (-Preference[PreferenceIndex]) - 1;
		Graph.GetSelectedNode().UpdatePreferences();
		Graph.Update();
		return;
	}

	// If the item is disabled, don't do anything
	if(Preference[PreferenceIndex] < 0)
		return;

	// Otherwise, it was a regular item. Find the next available index
	// If none are found, Nextindex should be the same as when it started
	var NextDomainIndex = Preference[PreferenceIndex];
	for(var x=0;x<Graph.GetSelectedNode().Domain.length;++x) // Try once for each domain item
	{
		++NextDomainIndex;
		if(NextDomainIndex >= Graph.GetSelectedNode().Domain.length)
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
	Graph.GetSelectedNode().UpdatePreferences();
	Graph.Update();
}



Graph.AddOnUpdateGUICallback("nodeeditor", function ()
{
	if(Graph.GetSelectedNode())
	{
    NodeNameDisplay.innerHTML = Graph.GetSelectedNode().Name;
		NodeNameInput.value = Graph.GetSelectedNode().Name;
		NodeNameInput.disabled = false;
		DomainListTextarea.disabled = false;
		DomainListTextarea.style.backgroundColor = "white";
		DomainListTextarea.value = Graph.GetSelectedNode().Domain.join("\n");
		ParentsListTable.style.backgroundColor = "white";
		ParentsListTable.innerHTML = GenerateParentsListHTML(Graph.GetSelectedNode());
		ManualDetectDegeneracyButton.style.display = Graph.GetSelectedNode().GetCPTListSize() > Graph.MAX_CPT_ENTRIES_BEFORE_MANUAL_DEGENERACY_DECTION ? "block" : "none";
		CPTTable.style.backgroundColor = "white";
		CPTTable.innerHTML = GenerateCPTHTML(Graph.GetSelectedNode());
		
		if(!Graph.Modifiable || Graph.GetIsLinking())
		{
			NodeNameInput.disabled = true;
			DomainListTextarea.disabled = true;
			ParentsListTable.disabled = true;
			CPTTable.disabled = true;
		}
	}
	else
	{
    NodeNameDisplay.innerHTML = "no selected node";
		NodeNameInput.value = "";
		NodeNameInput.disabled = true;
		DomainListTextarea.disabled = true;
		DomainListTextarea.style.backgroundColor = "#EEEEEE";
		DomainListTextarea.value = "";
		ParentsListTable.style.backgroundColor = "#EEEEEE";
		ParentsListTable.innerHTML = "";
		ManualDetectDegeneracyButton.style.display = "none";
		CPTTable.style.backgroundColor = "#EEEEEE";
		CPTTable.innerHTML = "";
	}
});


function GenerateParentsListHTML(Node)
{
	// Generate the parents list
	var HTML = "";
	for(var i=0;i<Node.Parents.length;++i)
	{
		// Degeneracy testing
		var degenerateLink = Node.IsParentDegenerate(i, Graph.MAX_CPT_ENTRIES_BEFORE_MANUAL_DEGENERACY_DECTION);
		var color = "#000";
		var type = "";
		switch(degenerateLink)
		{
			case 1:
				color = "red";
				type = " (degenerate)";
				break;
			case 2:
				color = "orange";
				type = " (possibly deg.)";
				break;
			case -2:
				break;
		}
			
		// Create HTML
		HTML += "<tr class='parents-table-row' onclick='SelectParentItemClicked(" + i + ")'> <td width='10%'> <img src='resources/removeitem.png' alt='Remove Node' onclick='RemoveParentNodeButtonClicked(" + i + ")'/> </td>";
		HTML += "<td width='90%'> <p style='color:" + color + ";'>" + Node.Parents[i].Name + type + "</p>";

		for(var j=0;j<Node.Parents[i].Domain.length;++j)
			HTML += "<p style='font-size:0.6em;padding:0;color:" + color + ";'>&emsp;&emsp;" + String.fromCharCode(97 + i) + (j+1) + ": " + Node.Parents[i].Domain[j] + "</p>";
		HTML += "</td> </tr>";
	}

	// Create the add parent node button
	if(Node.Parents.length < Graph.MaxInNodes)
	{
		// Get a list of nodes that could be added as parents to this node
		// (cant add self or any current parents as parent nodes)
		var addableNodes = [];
		for(var i=0;i<Graph.Nodes.length;++i)
			if(Graph.Nodes[i] !== Node && Node.Parents.indexOf(Graph.Nodes[i]) < 0)
				addableNodes.push(Graph.Nodes[i]);

		// Create the dropdown box and add button
		if(addableNodes.length > 0)
		{
			// Add the addnode row
			HTML += "<tr> <td width='10%'> <img src='resources/additem.png' alt='Add Node' onclick='AddParentNodeButtonClicked()'> </td>";

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

		// Highlighted
		var highlightedClass = "";
		if(CPList[i].highlight)
			highlightedClass = "class='cpt-table-highlighted-row'";

		// Add the condition
		HTML += "<tr " + highlightedClass + "> <td width='1px'> <p class='cpt-table-item'>" + conditionStr + ":&nbsp;&nbsp;</p> </td> <td>";

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


function HighlightCPTRow(condition)
{
	
}
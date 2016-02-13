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

var AddNodeButton = document.getElementById("add-node-button");
var DeleteNodeButton = document.getElementById("delete-node-button");
var LinkNodeButton = document.getElementById("link-node-button");
var AffixNodeButton = document.getElementById("affix-node-button");

var AllowCyclesCheckbox = document.getElementById("allow-cycles-checkbox");
var ShowCPTsInGraphCheckbox = document.getElementById("show-cpts-in-graph-checkbox");
var MaxInNodesSelector = document.getElementById("max-in-nodes-selector");
var NodeSpacingSelector = document.getElementById("node-spacing-selector");


function AddNodeButtonClicked()
{
	var N = new Node((new Date()).getTime().toString().slice(-6));
	if(Graph.GetSelectedNode())
		Graph.GetSelectedNode().LinkTo(N);
	N.AddToGraph(Graph.Nodes);
	Graph.Update();
}

function RemoveNodeButtonClicked()
{
	if(!Graph.GetSelectedNode())
		return;

  Graph.GetSelectedNode().Destroy(Graph.Nodes);
	Graph.Update();
}

function LinkNodesButtonClicked()
{
	if(Graph.GetSelectedNode())
	{
		if(Graph.GetIsLinking())
			Graph.StopLink();
		else
			Graph.StartLink();
	}
}

function AffixNodeButtonClicked()
{
	Graph.AffixNode(Graph.GetSelectedNode());
}

function AllowCyclesCheckChanged()
{
	Graph.AllowCycles = AllowCyclesCheckbox.checked;
}

function ShowCPTsInGraphCheckChanged()
{
	Graph.SetShowCPTs(ShowCPTsInGraphCheckbox.checked);
}

function MaxInNodesSelectorChanged()
{
	Graph.MaxInNodes = MaxInNodesSelector.value;
}

function NodeSpacingSelectorChanged()
{
	Graph.SetSpacing(NodeSpacingSelector.value);
}

// Graph callbacks

Graph.AddOnUpdateGUICallback("controls", function ()
{	
	if(Graph.GetIsLinking())
	{
		AddNodeButton.disabled = true;
		AddNodeButton.value = "Add Root Node";
		DeleteNodeButton.disabled = true;
		LinkNodeButton.disabled = false;
		LinkNodeButton.value = "Stop (Un)Linking";
		AffixNodeButton.disabled = true;
		AffixNodeButton.value = "Affix Selected Node";
	}
	else if(Graph.GetSelectedNode())
	{
		AddNodeButton.disabled = false;
		AddNodeButton.value = "Add Child Node to Selected";
		DeleteNodeButton.disabled = false;
		LinkNodeButton.disabled = false;
		LinkNodeButton.value = "(Un)Link Selected Node to...";
		AffixNodeButton.disabled = false;
		AffixNodeButton.value = ((Graph.GetSelectedNode().fixed & 1) == 1) ? "Unaffix Selected Node" : "Affix Selected Node";
	}
	else
	{
		AddNodeButton.disabled = false;
		AddNodeButton.value = "Add Root Node";
		DeleteNodeButton.disabled = true;
		LinkNodeButton.disabled = true;
		LinkNodeButton.value = "(Un)Link Selected Node to...";
		AffixNodeButton.disabled = true;
		AffixNodeButton.value = "Affix Selected Node";
	}
});

Graph.AddOnUpdateGraphCallback("controls", function ()
{
	// Check for cycles
	// More of a GUI update, but only changes when the nodes do, so keep this here
	var Cycles = DoesGraphHaveCycle(Graph.Nodes);
	if(Cycles)
		AllowCyclesCheckbox.checked = true;
	AllowCyclesCheckbox.disabled = Cycles;
});

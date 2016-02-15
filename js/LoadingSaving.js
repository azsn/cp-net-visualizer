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

var CPNetNameInput = document.getElementById("cp-net-name-input");
var SavedNotifier = document.getElementById("saved-notifier");

var Saved = true;

function SetSaved(Saved)
{
	window.Saved = Saved;
	SavedNotifier.innerHTML = "currently " + (Saved ? "saved" : "UNSAVED");
}

function AskForOverwrite(Func)
{
	if(Saved)
	{
		Func();
	}
	else
	{
		ShowMessageBox("The current CP-Net is unsaved. Do you really want to discard any unsaved changes and load a new CP-Net?",
			["No", "Yes"],
			function(button) {
				if(button === "Yes" || button === "_ENTER_")
					Func();
			});
	}
}

function LoadDefaultCPNet()
{
	AskForOverwrite(function()
	{
		// Reset the graph
		Graph.SelectNode(null);
		Graph.Nodes = [];

		// Create nodes
		var WeatherNode = new Node("Weather");
		var TimeNode = new Node("Time");
		var ActivityNode = new Node("Activity");
		var FriendNode = new Node("Friend");

		// Set their domain
		WeatherNode.SetDomain(["Fair", "Rain"]);
		TimeNode.SetDomain(["Afternoon", "Morning"]);
		ActivityNode.SetDomain(["Cycling", "Table Tennis"]);
		FriendNode.SetDomain(["Emily", "Henry"]);

		// Link them
		TimeNode.LinkTo(ActivityNode);
		WeatherNode.LinkTo(ActivityNode);
		ActivityNode.LinkTo(FriendNode);

		// Set preferences
		WeatherNode.SetPreference([], [0,0,1]); // Fair > Rain
		TimeNode.SetPreference([], [0,0,1]); // Afternoon > Morning
		ActivityNode.SetPreference([0,0], [0,0,1]); // Afternoon, Fair: Cycling > Table Tennis
		ActivityNode.SetPreference([0,1], [1,0,0]); // Afternoon, Rain: Table Tennis > Cycling
		ActivityNode.SetPreference([1,0], [1,0,0]); // Morning, Fair: Table Tennis > Cycling
		ActivityNode.SetPreference([1,1], [1,0,0]); // Morning, Rain: Table Tennis > Cycling
		FriendNode.SetPreference([0], [0,0,1]); // Cycling: Emily > Henry
		FriendNode.SetPreference([1], [1,0,0]); // Table Tennis: Henry > Emily
		
		// Add them to the graph
		WeatherNode.AddToGraph(Graph.Nodes);
		TimeNode.AddToGraph(Graph.Nodes);
		ActivityNode.AddToGraph(Graph.Nodes);
		FriendNode.AddToGraph(Graph.Nodes);
		Graph.AffixNode(ActivityNode, true); // Affix the node...
		Graph.Update();

		// Set to saved
		SetSaved(true);
		
		window.setTimeout(function() { Graph.AffixNode(ActivityNode, false); }, 100); // Then unaffix it 100ms later. Keeps the ActivityNode centered on the screen
	});
}

function LoadNewCPNet()
{
	AskForOverwrite(function()
	{
		// Reset the graph
		Graph.SelectNode(null);
		Graph.Nodes = [];
		
		// Create and add node to the graph
		(new Node("root node")).AddToGraph(Graph.Nodes);
		Graph.Update();

		// Set to saved
		SetSaved(true);
	});
}

function LoadCPNetFromFile()
{
	AskForOverwrite(function()
	{
		LoadFile(function(name, contents) {
			var graph = XMLToGraph(contents);
			if(graph)
			{
				// Get file name
				CPNetNameInput.value = name.replace(/\.[^/.]+$/, ""); // Remove the file extension from the name

				// Set graph
				Graph.SelectNode(null);
				Graph.Nodes = graph.nodes;
				Graph.Update();

				// Show errors
				if(graph.errors.length > 0)
					ShowMessageBox("Loading errors:<br>" + graph.errors.join("<br>"));

				// Set to saved
				SetSaved(true);
			}
			else
			{
				ShowMessageBox("Unable to load file due to bad XML.");
			}
		});
	});
}

function SaveCPNetAsXML()
{
	// Convert the Graoh to XML
	var XmlString = GraphToXML(Graph.Nodes);

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

function SaveCPNetAsSVG()
{
	// Get the save name
	var Name = CPNetNameInput.value;
	if(isEmptyOrSpaces(Name))
		Name = "cpnet";
	
	// Get the SVG HTML
	var html = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + document.documentElement.clientWidth + " " + document.documentElement.clientHeight + '">'
					 + "<style type='text/css'> <![CDATA[.node { cursor: default; font-size: 12pt; } .node-circle { stroke-width: 1px; stroke: black; fill: white; } .link, .linking-arrow { stroke-width: 1.5px; opacity: 0.4; marker-end: url(#end-arrow); } .linking-arrow { stroke: #7585CF; } .node-name-text { font-family: Helvetica, Arial, sans-serif; font-size: 0.5em; fill: black; text-anchor: middle; dominant-baseline: middle; pointer-events: none; } .node-cpt-text { text-anchor: start; font-size: 0.3em; } .node-cpt-highlighted-text { text-anchor: start; font-size: 0.7em; fill: #7585CF; font-weight: bold; }]]></style>"
					 + Graph.SvgRoot.node().innerHTML
					 + '</svg>';

	// Save it
	var blob = new Blob([html], {type: "text/plain;charset=utf-8"});
	saveAs(blob, Name + ".svg"); // From the FileSaver.js API
}

// Load the default CPNet when the window finishes loading
window.addEventListener('load', function() {
	LoadDefaultCPNet();
}, false);

// Warn before leaving if unsaved
window.addEventListener("beforeunload", function (e) {
  if(Saved)
    return undefined;
    
  var confirmationMessage = "This CP-Net is unsaved. Your changes will be lost if you exit now!";

  (e || window.event).returnValue = confirmationMessage; //Gecko + IE
  return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

// When the graph changes, set unsaved
Graph.AddOnUpdateGraphCallback("loadingsaving", function ()
{
  SetSaved(false);
});
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

var OptionsPanel = document.getElementById("options-panel");
var FlippingSequencePanel = document.getElementById("flipping-sequence-panel");

var WasShowingCPTs = false;

function VisualizeFlippingSequence()
{
	if(IsRunningElectron()) // If electron, run the flipping sequnece generator executable to generate the XML ourselves
	{
		GenerateAndLoadFlippingSequence();
	}
	else // If not, ask the user to upload a flipping sequence XML file
	{
		ShowMessageBox("Automatic DT* is unavailable when not running in Electron. You must select an XML output file from DT* manually.", null, function() {
			LoadFlippingSequenceXMLFromFile();
		});
	}
}

function GenerateAndLoadFlippingSequence() // This function requires Electron
{
	var dtstar = require('dtstar');
	
	// Create GUI for selecting best and worse outcomes
	var div = d3.select(document.createElement('div'));
	div.append('p').text("Choose a 'better' and a 'worse' outcome; DT* will be used to find the flipping sequence between the two, if one exists.")
	
	var rootTable = div.append('center').append('table').style('margin-bottom', "1.3em");
	
	var ends = ['Better', 'Worse'];
	
	var topRow = rootTable.append('tr');
	topRow.append('td'); // Empty cell
	for(var i=0;i<ends.length;++i)
		topRow.append('td').text(ends[i]);

	for(var i=0;i<Graph.Nodes.length;++i)
	{
		var row = rootTable.append('tr');
		row.append('td').append('p').text(Graph.Nodes[i].Name).style('margin', "0 5px 0 5px").style('text-align', 'left');
		
		for(var j=0;j<ends.length;++j)
		{
			var select = row.append('td').style('padding', "0 5px 0 5px").append('select').style('width', "100%");
			select.attr("id", "flipseqselector_node" + i + "_end" + j);
			
			for(var k=0;k<Graph.Nodes[i].Domain.length;++k)
				select.append('option').attr('value', Graph.Nodes[i].Domain[k]).text(Graph.Nodes[i].Domain[k]);
		}
	}
	
	// FOR SINGLE COMLUMN
	// for(var i=0;i<ends.length;++i)
	// {
	// 	var rootTableCol = rootTableRow.append('td');
	// 	
	// 	rootTableCol.append('p').text(ends[i].name + " outcome").style('margin-bottom', 0);
	// 	var table = rootTableCol.append('center').append('table');
	// 	
	// 	for(var j=0;j<Graph.Nodes.length;++j)
	// 	{
	// 		if(Graph.Nodes[j].Domain.length == 0)
	// 			continue;
	// 		
	// 		var row = table.append('tr');
	// 		row.append('td').append('p').text(Graph.Nodes[j].Name).style('margin', 0).style('text-align', 'left');
	// 		var select = row.append('td').append('select').style('width', "100%");
	// 		
	// 		select.attr('id', "genflipseq-" + ends[i].name + Graph.Nodes[j].Name);
	// 		for(var k=0;k<Graph.Nodes[j].Domain.length;++k)
	// 			select.append('option').attr('value', Graph.Nodes[j].Domain[k]).text(Graph.Nodes[j].Domain[k]);
	// 		select.attr('value', Graph.Nodes[j].Domain[0]);
	// 	}
	// }

	ShowMessageBox(div.html(), ["Cancel", "Okay"], function(b) {
		if(b !== "Okay")
			return;
			
		// Generate query XML
		var QueryXML = "<?xml version='1.0' encoding='us-ascii'?>\n<PREFERENCE-QUERY>\n";
		QueryXML +=    "  <PREFERENCE-SPECIFICATION-FILENAME>%PREF_SPEC_NAME%</PREFERENCE-SPECIFICATION-FILENAME>\n"
		QueryXML +=    "  <QUERY-TYPE>DOMINANCE</QUERY-TYPE>\n";
		
		for(var i=0;i<ends.length;++i)
		{
			QueryXML += "  <OUTCOME>\n";
			QueryXML += "    <LABEL>" + ends[i].toUpperCase() + "</LABEL>\n";
			
			for(var j=0;j<Graph.Nodes.length;++j)
			{
				QueryXML += "    <ASSIGNMENT>\n";
				QueryXML += "      <PREFERENCE-VARIABLE>" + Graph.Nodes[j].Name + "</PREFERENCE-VARIABLE>\n";
				QueryXML += "      <VALUATION>" + d3.select("#flipseqselector_node" + j + "_end" + i).node().value + "</PREFERENCE-VARIABLE>\n";
				QueryXML += "    </ASSIGNMENT>\n";
			}
			
			QueryXML += "  </OUTCOME>\n";
			QueryXML += "</PREFERENCE-QUERY>\n";
		}
		
		var GraphXML = GraphToXML(Graph.Nodes);
		// TODO: Some kind of loading message box here
		dtstar.generateProof(QueryXML, GraphXML, function(contents) {
			var flippingSequence = XMLToFlippingSequence(contents, Graph.Nodes);
			
			if(flippingSequence && flippingSequence.constructor === Array)
			{
				StartFlippingSequence(flippingSequence);
			}
			else
			{
				if(!flippingSequence) flippingSequence = "Unable to load flipping sequence file due to bad XML.";
				ShowMessageBox("Error loading flipping sequence:<br>" + flippingSequence);
			}
		});
	});
}

function LoadFlippingSequenceXMLFromFile()
{
	LoadFile(function(name, contents) {
		var flippingSequence = XMLToFlippingSequence(contents, Graph.Nodes);
		
		if(flippingSequence && flippingSequence.constructor === Array)
		{
			StartFlippingSequence(flippingSequence);
		}
		else
		{
			if(!flippingSequence) flippingSequence = "Unable to load flipping sequence file due to bad XML.";
			ShowMessageBox("Error loading flipping sequence:<br>" + flippingSequence);
		}
	});
}

function StartFlippingSequence(FlippingSequence)
{
  FlippingSequencePanel.style.display = "initial";
  OptionsPanel.style.display = "none";
  
	Graph.Modifiable = false;
	Graph.SelectNode(null);
	Graph.SetSelectionColor(d3.select("#flipping-sequence-panel").style("background-color"));
	WasShowingCPTs = Graph.GetShowCPTs();
	Graph.SetShowCPTs(true);
  var Table = d3.select("#flipping-sequence-list");
	Table.selectAll("*").remove();
		
	var rows = [];
	for(var i=0;i<FlippingSequence.length;++i)
	{
		var row = Table.append('tr').attr('class', "flipping-sequence-item");
		rows.push(row);
		
		var keys = [];
		for(var prop in FlippingSequence[i])
			if(FlippingSequence[i].hasOwnProperty(prop))
				keys.push(prop);
		keys.sort();
		
		var text = "";
		var changedNode = null;
		for(var j=0;j<keys.length;++j)
		{
			if(FlippingSequence[i][keys[j]].changed)
			{
				text += "<b>" + keys[j] + ": " + FlippingSequence[i][keys[j]].value + "</b><br />";
				if(i > 0)
					changedNode = FlippingSequence[i][keys[j]].node;
			}
			else
			{
				text += keys[j] + ": " + FlippingSequence[i][keys[j]].value + "<br />";
			}
		}
		
		row.append('td').append('p').attr('class', "flipping-sequence-item-index").text(i+1); 
		row.append('td').append('p').html(text);

		var onClickFunc = (function(index, node) { return function() {
			for(var j=0;j<rows.length;++j)
				rows[j].attr('class', "flipping-sequence-item");
			rows[index].attr('class', "flipping-sequence-item-clicked");

			for(var j=0;j<Graph.Nodes.length;++j)
				Graph.Nodes[j].HighlightedCPTRow = null;

			if(index > 0)
			{
				var highlightCondition = [];
				for(var j=0;j<node.Parents.length;++j)
				{
					var assignment = FlippingSequence[index][node.Parents[j].Name];				
					for(var k=0;k<node.Parents[j].Domain.length;++k)
					{
						if(assignment.value == node.Parents[j].Domain[k])
						{
							highlightCondition.push(k);
							break;
						}
					}
				}
				
				node.HighlightedCPTRow = highlightCondition;
			}
		
			for(var j=0;j<Graph.Nodes.length;++j)
				Graph.Nodes[j].ListCPT(true);
		
			Graph.SelectNode(node);
			Graph.UpdateNodeCPTs();
			
		}})(i, changedNode);
		row.on('click', onClickFunc);
	}
	
	rows[0].attr('class', "flipping-sequence-item-clicked");
}

function StopFlippingSequence()
{
  FlippingSequencePanel.style.display = "none";
  OptionsPanel.style.display = "initial";
	Graph.Modifiable = true;
	
	for(var i=0;i<Graph.Nodes.length;++i)
	{
		Graph.Nodes[i].HighlightedCPTRow = null;
		Graph.Nodes[i].ListCPT(true);
	}
	
	Graph.SetSelectionColor(null); // Also refreshes the GUI
	Graph.SetShowCPTs(WasShowingCPTs);
}

function XMLToFlippingSequence(XmlString, Nodes)
{
	// Validate the XML string
	if(isEmptyOrSpaces(XmlString))
		return null;

	var Root = parseXml(XmlString); // Parse the XML string
	if(!Root)
		return null;

	if(!Root.childNodes || Root.childNodes.length <= 0)
		return null;

	Root = Root.getElementsByTagName("PROOF")[0];
	if(!Root || !Root.childNodes || Root.childNodes.length <= 0)
		return null;

  // Vars
  var Outcomes = [];
	
	// Read the XML
	for(var i=0;i<Root.childNodes.length;++i)
	{
		if(Root.childNodes[i].tagName !== "OUTCOME")
			continue;
    
    var assignments = Root.childNodes[i].getElementsByTagName("ASSIGNMENT");
    
		if(assignments.length != Nodes.length)
			return "Outcome " + i + " has a different number of assignments than there are nodes in the graph.";
		
    var outcome = {};
    for(var j=0;j<assignments.length;++j)
    {
			// Get the variable and value from the XML
      var variable = assignments[j].getElementsByTagName("PREFERENCE-VARIABLE")[0];
      var value = assignments[j].getElementsByTagName("VALUATION")[0];
      if(!variable || !value)
        continue;
			
			// If the previous outcome had this same assignment, skip (no duplicates; only show changes)
			if(Outcomes.length > 0)
			{
				if(Outcomes[Outcomes.length-1][variable.textContent].value == value.textContent)
				{
					outcome[variable.textContent] = {value: value.textContent, changed: false};
					continue
				}
			}
			
			// Validate this assignment with the given set of Nodes
			var node = null;
			for(var k=0;k<Nodes.length;++k)
			{
				if(Nodes[k].Name == variable.textContent)
				{
					node = Nodes[k];
					break;
				}
			}
			
			if(!node)
				return "Assignment " + j + " on outcome " + i + " refers to a nonexistant node.";
			
			var foundDomain = false;
			for(var k=0;k<node.Domain.length;++k)
			{
				if(node.Domain[k] == value.textContent)
				{
					foundDomain = true;
					break;
				}
			}
			
			if(!foundDomain)
				return "Assignment " + j + " on outcome " + i + " refers to a nonexistant domain value on node " + node.Name + ".";
			
			// Add assignment to current outcome
			outcome[variable.textContent] = {value: value.textContent, changed: true, node: node};
    }
  			
    Outcomes.push(outcome);
  }
  
  return Outcomes;
}



// outcome.push({variable: variable.textContent, value: value.textContent});
//outcome.sort(function (a, b) { return (a.variable > b.variable) ? 1 : ((b.variable > a.variable) ? -1 : 0);});

// var OutcomesNoDups = [Outcomes[0]];
// 
// // Each outcome should only contain changes since the previous outcome
// for(var i=1;i<Outcomes.length;++i)
// {
// 	var outcomeNoDups = [];
// 	
// 	for(var j=0;j<Outcomes[i].length;++j)
// 	{
// 		var k=0;
// 		
// 		for(;k<Outcomes[i-1].length;++k)
// 			if(Outcomes[i-1][k].variable == Outcomes[i][j].variable)
// 				break;
// 		
// 		if(k > Outcomes[i-1].length || Outcomes[i-1][k].value != Outcomes[i][j].value)
// 			outcomeNoDups.push(Outcomes[i][j]);
// 	}
// 	
// 	OutcomesNoDups.push(outcomeNoDups);
// }
var OptionsPanel = document.getElementById("options-panel");
var FlippingSequencePanel = document.getElementById("flipping-sequence-panel");

var WasShowingCPTs = false;

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
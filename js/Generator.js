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

function GenerateCPNet()
{
	if(!IsRunningElectron())
  {
    ShowMessageBox("CP-net generation is only available when running in Electron. Otherwise, you must run gencpnet manually.");
    return;
  }

  var gencpnet = require('gencpnet');

  var div = d3.select(document.createElement('div'));
  div.append('p').text("Enter parameters for the generated CP-net.")
  
  var rootTable = div.append('center').append('table').style('margin-bottom', "1.3em");
  
  // Options (flags to gencpnet)
  var indegreeBound = rootTable.append('tr');
	indegreeBound.append('td').text("Indegree bound");
  indegreeBound.append('td').append('input').attr('type', 'number').attr('min', 1).attr('max', 20).attr('value', 5).attr('id', "indegree-bound-selector").style('width', "100%");

  var domainSize = rootTable.append('tr');
	domainSize.append('td').text("Domain size");
  domainSize.append('td').append('input').attr('type', 'number').attr('min', 2).attr('value', 2).attr('id', "domain-size-selector").style('width', "100%");

  var numNodes = rootTable.append('tr');
	numNodes.append('td').text("Number of nodes");
  numNodes.append('td').append('input').attr('type', 'number').attr('min', 1).attr('value', 5).attr('id', "num-nodes-selector").style('width', "100%");

  ShowMessageBox(div.html(), ["Cancel", "Okay"], function(b) {
    if(b !== "Okay" && b !== "_ENTER_")
      return;
    
    var nn = d3.select("#num-nodes-selector").node().value;
    var ds = d3.select("#domain-size-selector").node().value;
    var ind = d3.select("#indegree-bound-selector").node().value;
    
    ShowMessageBox("Generating CP-net...", ["Stop"], function(x) {
			if(x == "Stop" || x == "_ESC_" || x == "_ENTER_")
				gencpnet.stopGenerate();
		});
  
    gencpnet.generate(ind, ds, nn, function(e, contents) {
      CloseMessageBox();
      
      if(e == "STOPPED") {
        return;
      }
      else if(e == "GENERROR") {
        ShowMessageBox(contents);
        return;
      }
      else if(e) {
        ShowMessageBox("An error occurred while running gencpnet. The JavaScript console might help.");
        return;
      }
      
      var graph = XMLToGraph(contents);
			if(graph)
			{
				CPNetNameInput.value = "gen_n" + nn + "c" + ind + "d" + ds;

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
				ShowMessageBox("Unable to load generated CP-net due to bad XML.");
			}
    });
    return true; // Don't close the message box automatically, otherwise the "calculating.." box gets closed immediately.
  });
}
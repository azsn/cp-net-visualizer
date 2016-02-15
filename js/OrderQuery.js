function OrderQuery(){
    // Create GUI for selecting best and worse outcomes
    var div = d3.select(document.createElement('div'));
    div.append('p').text("Choose two outcomes. The order querying algorithm will check whether the CP-net is consistent with one being preferred to the other.")
    
    var rootTable = div.append('center').append('table').style('margin-bottom', "1.3em");
    
    var ends = ['Outcome1', 'Outcome2'];
    
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
    
    ShowMessageBox(div.html(), ["Cancel", "Okay"],function(b){
        if(b !== "Okay" && b !== "_ENTER_")
            return; //Simply exit the callback if the user doesn't want to do anything.
        
        //extract the two values
        var outcomes = [];
        for(var i=0;i<ends.length;++i)
        {
            outcomes.push([]);
            
            for(var j=0;j<Graph.Nodes.length;++j)
            {
                outcomes[i].push(d3.select("#flipseqselector_node"+j+"_end"+i).node().value);
            }
        }
        
        //TODO: iterate through nodes and check whether the two values are equal on their parents
        var outcome0NotNecessarilyWorse = false;
        var outcome1NotNecessarilyWorse = false;
        for(var j=0; j<Graph.Nodes.length;++j){
            var out0X = outcomes[0][j];
            var out1X = outcomes[1][j];
            if(out0X != out1X){
                //Check to see if they match on their parents.
                var parentList = Graph.Nodes[j].Parents;
                var parentDomainIndices = [];
                var matchesSoFar = true;
                for(var parent = 0; parent < parentList.length; parent++){
                    var parentIndex = getNodeIndex(parentList[parent].Name);
                    if(outcomes[0][parentIndex]!=outcomes[1][parentIndex]){
                        matchesSoFar = false;
                    } else {
                        parentDomainIndices.push(parentList[parent].Domain.indexOf(outcomes[0][parentIndex]));
                    }
                }
                if(matchesSoFar){
                    //Check whether which one is preferred according to the CPT for node at index j
                    //Determine Domain Indices
                    var domainIndex0 = Graph.Nodes[j].Domain.indexOf(out0X);
                    var domainIndex1 = Graph.Nodes[j].Domain.indexOf(out1X);
                    var prefIndex0;
                    var prefIndex1;
                    var CPTRow = Graph.Nodes[j].CPT;
                    for(var parent=0; parent<parentDomainIndices.length; parent++){
                        CPTRow = CPTRow[parentDomainIndices[parent]];
                    }
                    for(var prefIndex = 0; prefIndex < CPTRow.length; prefIndex+=2){
                        if(CPTRow[prefIndex]==domainIndex0){
                            prefIndex0 = prefIndex;
                        }
                        if(CPTRow[prefIndex]==domainIndex1){
                            prefIndex1 = prefIndex;
                        }
                    }
                    if(prefIndex0<prefIndex1){
                        outcome0NotNecessarilyWorse=true;
                    } else if(prefIndex1<prefIndex0){
                        outcome1NotNecessarilyWorse=true;
                    }
                }
            } // else the two are equal and no information is gained.
        }
        
        //TODO: Output results better
        var div = d3.select(document.createElement('div'));
        div.append('h2').text("The Ordering Query Showed That:");
        if(outcome0NotNecessarilyWorse){
            div.append('p').text(outcomeString(outcomes[0]) + " is permitted by the CP-net to be preferred to " + outcomeString(outcomes[1]));
        }
        if(outcome1NotNecessarilyWorse){
            div.append('p').text(outcomeString(outcomes[1]) + " is permitted by the CP-net to be preferred to " + outcomeString(outcomes[0]));
        }
        if(!outcome0NotNecessarilyWorse && !outcome1NotNecessarilyWorse){
            div.append('p').text("The given outcomes " + outcomeString(outcomes[0]) + " and " + outcomeString(outcomes[1]) + " are identical.");
        }
        ShowMessageBox(div.html(), ["Okay"], function(b){});
        return true;
    })
};

function getNodeIndex(nodeName){
    for(var j = 0; j < Graph.Nodes.length; ++j){
        if(Graph.Nodes[j].Name == nodeName){
            return j;
        }
    }
    return -1;
};

function outcomeString(listOfAssignments){
    var stringToReturn = "";
    if(listOfAssignments.length > 0){
        stringToReturn += listOfAssignments[0];
    } else {
        stringToReturn += "Null Outcome";
    }
    for(var i = 1; i < listOfAssignments.length; i++){
        stringToReturn += ", "+listOfAssignments[i];
    }
    return stringToReturn;
}
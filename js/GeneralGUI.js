var CurrentMessageBox = null;

function ShowMessageBox(BodyHTML, Buttons, OnButtonClick)
{
  var MessageBoxModalBackground = d3.select('body').append('div').attr('class', "messagebox-modal-background");
  var MessageBox = d3.select('body').append('div').attr('class', "messagebox");
  
  var Body = MessageBox.append('div').attr('class', "messagebox-header");
  var ButtonList = MessageBox.append('div').attr('class', "messagebox-buttonlist");
  
  Body.html(BodyHTML);
  
  if(!Buttons || Buttons.constructor !== Array || Buttons.length == 0)
    Buttons = ["Okay"];
    
  for(var i=0;i<Buttons.length;++i)
  {
    var button = ButtonList.append('input').attr('type', 'button').attr('value', Buttons[i]);
    
    button.on('click', function() {
      if(typeof OnButtonClick === 'function') OnButtonClick(this.value);
			MessageBox.remove();
			MessageBoxModalBackground.remove();
			CurrentMessageBox = null;
		});
  }
  
  CurrentMessageBox = MessageBox;
	RepositionMessageBox();
}

function RepositionMessageBox()
{
	if(!CurrentMessageBox)
		return;
    
	CurrentMessageBox.style('top', (document.documentElement.clientHeight/2 - CurrentMessageBox.node().clientHeight/2) + 'px')
                   .style('left', (document.documentElement.clientWidth/2 - CurrentMessageBox.node().clientWidth/2) + 'px');
}

window.addEventListener('resize', function() {
	RepositionMessageBox();
}, false);




function LoadFile(Callback)
{
  if(typeof Callback !== 'function')
    return false;
    
  // Make sure the user's browser supports loading files
	if (!window.File || !window.FileList || !window.FileReader || !window.Blob)
	{
    ShowMessageBox("Unable to load file due to no file reading support. Update your dang browser!");
		return false;
	}
  
  var FileSelectButton = d3.select("body").append("input").attr("type", "file").style("display", "none");
  
  FileSelectButton.on('change', function () {
    // Get first selected file
    var File = d3.event.target.files;
    if(File.length <= 0)
      return;
    File = File[0];

    // Read file contents
    var Reader = new FileReader();

    // Closure to capture the file information.
    Reader.onload = function(e) {
      Callback(File.name, e.target.result);
    };

    // Read in the image file as a data URL.
    Reader.readAsText(File);
  }, false);

  // Simulate clicking the button to open the file upload dialog
  FileSelectButton.node().click();
  
  // Remove the upload button now that we're done
  // This actually removes the button before the user has even selected a file, but it still works (tested Chrome, Firefox, Safari)
  FileSelectButton.remove();
  
  return true;
}
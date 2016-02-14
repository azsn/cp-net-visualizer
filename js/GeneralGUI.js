var MessageBoxCurrent = null;
var MessageBoxCurrentModalBackground = null;
var MessageBoxCurrentCallback = null;

function ShowMessageBox(BodyHTML, Buttons, OnButtonClick)
{
  CloseMessageBox();
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
      var close = true;
      if(typeof OnButtonClick === 'function' && OnButtonClick(this.value))
          close = false;
      if(close)
        CloseMessageBox();
		});
  }
  
  MessageBox.node().focus();
  
  MessageBoxCurrent = MessageBox;
  MessageBoxCurrentModalBackground = MessageBoxModalBackground;
  MessageBoxCurrentCallback = OnButtonClick;
	RepositionMessageBox();
}

function RepositionMessageBox()
{
	if(!MessageBoxCurrent)
		return;
    
	MessageBoxCurrent.style('top', (document.documentElement.clientHeight/2 - MessageBoxCurrent.node().clientHeight/2) + 'px')
                   .style('left', (document.documentElement.clientWidth/2 - MessageBoxCurrent.node().clientWidth/2) + 'px');
}

function CloseMessageBox()
{
  if(MessageBoxCurrent)
    MessageBoxCurrent.remove();
  if(MessageBoxCurrentModalBackground)
    MessageBoxCurrentModalBackground.remove();
  MessageBoxCurrent = null;
  MessageBoxCurrentModalBackground = null;
  MessageBoxCurrentCallback = null;
}

window.addEventListener('resize', function() {
	RepositionMessageBox();
}, false);

window.addEventListener('keydown', function (e) {
  var key = e.which || e.keyCode;
  if(MessageBoxCurrent)
  {
    if(key === 13 || key === 27) // 13 enter, 27 esc
    {
      var close = true;
      if(typeof MessageBoxCurrentCallback === 'function' && MessageBoxCurrentCallback((key === 13) ? "_ENTER_" : "_ESC_"))
        close = false;
      if(close)
        CloseMessageBox();
    }
  }
});




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

// Returns true if this code is running in GitHub's Electron or not (otherwise, probably a regular browser)
// If this is running in Electron, some parts of this program have extra features.
// The main parts of the Visualizer will run fine without Electron, however.
function IsRunningElectron()
{
  return typeof(process) !== 'undefined' && typeof(process.versions['electron']) !== 'undefined';
}
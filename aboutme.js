/*java script page!*/

/* var clickerButton = document.querySelectorAll(".button");

var onButtonClick=function(){
	var bodyColor=document.getElementByTagName("body");
	bodyColor.style.background=red;
}

clickerButton.addEventListener("click", onButtonClick);

var bluered= document.getElementByTagName("body");
bluered.style.background="red";
 */
 
 

var allButtons = document.getElementsByTagName("button");
addFun();
var bodyEl= document.getElementsByClassName("rButton");

function getAllButtons(){
	 //var allButtons = document.getElementsByTagName("p");
	
	
	var num = allButtons.length;
	
	console.log(bodyEl);
		for (i=0;i<bodyEl.length;i++)
		{
		bodyEl[i].style.backgroundColor= "red";
		} 
	 alert("there are " + num + "buttons");
 }

 function addFun(){
	 allButtons.onclick=getAllButtons();
 }
 
 
 

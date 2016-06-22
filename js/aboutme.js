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
var bodyEl= document.getElementsByClassName("rButton");
var bodyMain= document.querySelector("body");
var bList=document.querySelector(".bgButtons");
var infoGroup=document.querySelectorAll(".info");



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

function redBg(){

	bList.style.background="red";
	bodyMain.style.background="black";
	bodyMain.style.color="white";
	
}
function blueBg(){

	bList.style.background="blue";
	bodyMain.style.background="black";
	bodyMain.style.color="white";
	
}
function greenBg(){

	bList.style.background="green";
	bodyMain.style.background="black";
	bodyMain.style.color="white";
	
}
function infoButtonClick(a){
	hideAll();
	console.log(infoGroup[a]);
	infoGroup[a].style.display="block";

	
	
}
 function resetAll(){
	bList.style.background="red";
	bodyMain.style.background="white";
	read();
	hideAll();
	infoButtonClick(0);
 }
 
function hideAll(){
	for(i=0;i<infoGroup.length;i++){
		infoGroup[i].style.display="none";
	}
	
}

function read(){
	console.log(infoGroup);
}

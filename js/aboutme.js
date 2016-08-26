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
var compList= document.getElementById("csList");
var geoList=document.getElementById("gList");

var cs=0;
var geog=0;
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
	bodyMain.style.color="yellow";
	
}
function blueBg(){

	bList.style.background="blue";
	bodyMain.style.background="black";
	bodyMain.style.color="orange";
	
}
function greenBg(){

	bList.style.background="green";
	bodyMain.style.background="black";
	bodyMain.style.color="brown";
	
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
	bList.style.borderStyle="double";
	bodyMain.style.color="black";
 }
 
function hideAll(){
	for(i=0;i<infoGroup.length;i++){
		infoGroup[i].style.display="none";
	}
}

function read(){
	console.log(infoGroup);
}

function hideSect(a){

	if (a==0){
		this.cs=this.cs+1;
		console.log("cs is " + this.cs);
		if (this.cs%2==1){
			compList.style.display="none";
		}
		else{
			compList.style.display="block";
		}
	}
	else{
		this.geog=this.geog+1;
		console.log("geog is "+ this.geog);
		if (this.geog%2==1){
			geoList.style.display="none";	
		}
		else{
			geoList.style.display="block";
		}
	}
}

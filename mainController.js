(function(){
	
	var app = angular.module("app", []);

	var mainController=($scope, $location, $routeParams){
		
		$scope.changeView = function(name){
			$location.path("/#!"+ name);
		};

	};
	

	app.controller("mainController", mainController);




}());
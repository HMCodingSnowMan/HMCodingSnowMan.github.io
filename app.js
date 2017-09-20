(function(){
	
	var app= angular.module("app",["ngRoute"]);
	
	app.config(function($routeProvider){
		$routeProvider
			.when("/main", {
				templateUrl:"main.html"
			})
			.when("/college", {
				templateUrl:"college.html"
			})
			.when("/cprojects", {
				templateUrl:"cprojects.html"
			})
			.when("/pprojects", {
				templateUrl:"pprojects.html"
			})
			.when("/work", {
				templateUrl:"work.html"
			})
			.otherwise({redirectTo:"/main"});
	});
	
}());
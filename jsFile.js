var map;
var theMarker;
var wordsToIgnore = ["kommun", "Kommune", "Municipality", "municipality", "Town of ", "City of ", "District", "district", "County", "Region of "];
var previousImage;
var satelliteImageDiv;
var weatherArray = [];
const countriesAndRegions = new CountriesAndRegions();

//set up the google map
function setUpMap() {
  var mapProp = {
    scrollwheel: true,
    mapTypeControl: false,
    zoomControl: true,
    center: new google.maps.LatLng(55.6050,13.0038),
    zoom:9,
    streetViewControl: false,
    
    styles: [
      {elementType: "geometry", stylers: [{ color: "#306844	"}]},
      {elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }]},
      {elementType: "labels.text.fill", stylers: [{ color: "#746855" }]},
      {featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }]},
      {featureType: "road",elementType: "labels",stylers: [{ visibility: "off" }]}
    ],
  }; 
  map = new google.maps.Map(document.getElementById("googleMap"),mapProp);
  drawOnclick();
  map.addListener("click", (mapsMouseEvent) => {
    var str = mapsMouseEvent.latLng.toString().replace('(', '').replace(',', '').replace(')', '');
    var spaceIndex = str.indexOf(' ');
    var lat = str.substring(0, spaceIndex);
    var lng = str.substring((spaceIndex+1), str.length);
    resetList();
    fetchWeather(lat, lng);
    theMarker.setPosition(mapsMouseEvent.latLng);
  });
}

//method that fetches the weather information about the place
function fetchWeather(lat, lon) {
  getSatelliteImage(Math.round(lat), Math.round(lon));
  const url = "https://api.openweathermap.org/data/2.5/weather?lat=" + lat + "&lon=" + lon + "&units=metric&appid=f830d19d1d0d2c9756713e02715ab674";
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      //put the weather info in the weatherArray
      weatherArray.push('<li id="listItem">Current weather:' + data.weather[0].description + "</li>");
      weatherArray.push('<li id="listItem">Temperature:' + data.main.temp + "</li>");
      weatherArray.push('<li id="listItem">Max temperature:' + data.main.temp_max + "</li>");
      weatherArray.push('<li id="listItem">Min temperature:' + data.main.temp_min + "</li>");
      weatherArray.push('<li id="listItem">Humidity:' + data.main.humidity + "</li>");
      
      if (!data.name || data.name.length === 0) {
        showInfo("No wikipedia article!", "Please choose a different place!");
      } else {
        const countryName = countriesAndRegions.getCountryOrRegionName(data.sys.country);
        let theRegion;
        fetch("http://api.openweathermap.org/geo/1.0/reverse?lat=" + lat + "&lon=" + lon + "&limit=5&appid=f830d19d1d0d2c9756713e02715ab674")
          .then((response) => response.json())
          .then((data2) => {
            if (data2[0] && data2[0].state) {
              theRegion = data2[0].state;
            } else {
              theRegion = null;
            }
            //filter names
            filterNames(data.name, countryName, theRegion);
            const theIcon = {
              url: "http://openweathermap.org/img/wn/" + data.weather[0].icon + "@2x.png",
              scaledSize: new google.maps.Size(80, 80)
            };
            theMarker.setIcon(theIcon);
          }).catch((error) => console.log(error));
      }}).catch((error) => console.log(error));
    }

//shows the weather info
function putWeatherInfo(){
  const searchList = $("#searchList");
  weatherArray.forEach(element =>{
    searchList.append(element);
  });
}

//filter names
function filterNames(placeName, countryName, regionName) {
  const wordsToIgnore = ["City", "Town", "Village", "Province", "State"]; //if the name contains any of these, ignore them
  for (let i = 0; i < wordsToIgnore.length; i++) {
    const word = wordsToIgnore[i];
    if (placeName.includes(word)) {
      placeName = placeName.replace(word, '');
      break;
    }
  }
  countryName = countryName.replace(/ *\([^)]*\) */g, "");//ignore the parentheses 
  getWikipediaArticleWithRegion(placeName, regionName, countryName);//see if there is a Wikipedia article about the place
}

//get the Wikipedia article for a specific place
//the method checks if there is a Wikipedia article with the title place,_regionName
function getWikipediaArticleWithRegion(place, regionName, countryName) {
  var url = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=" + place + ",_" + regionName + "&rvprop=coordinates&callback=?";  
  $.getJSON(url, function (data) {
    var obj = data.query.pages;
    var ob = Object.keys(obj)[0];
    try{
      if(obj[ob]['extract'] !== undefined && obj[ob]['extract'] !== null &&  obj[ob]['extract'].length!==0){
        showInfo(obj[ob].title, obj[ob]['extract']);
      }else{
        getWikipediaArticle(place, regionName, countryName);//check if there is a Wikipedia article about that place, but now ignore the regionName
      }
  }catch (error) {
      console.log(error);
    }
  });
}

//get Wikipedia article
function getWikipediaArticle(place, regionName, countryName) {
  var url = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=" + place + "&rvprop=coordinates&callback=?";  
  $.getJSON(url, function (data) {
    var obj = data.query.pages;
    var ob = Object.keys(obj)[0];
    try{
      if(obj[ob]['extract'] !== undefined ){
        if(obj[ob]['extract'].length!==0 && !obj[ob]['extract'].includes("refer to ") && !obj[ob]['extract'].includes("refers to ") && hasCountryOrRegion(obj[ob]['extract'], countryName, regionName)){
          showInfo(obj[ob].title, obj[ob]['extract']);
        }else{
          getWikipediaRegion(regionName, countryName); //if there is no Wikipedia article about that place, see if there is a Wikipedia article about that region
        }
      }else{
        getWikipediaRegion(regionName, countryName);
      }
    }
    catch (error) {
      console.log(error);
    }
  });
}

//get Wikipedia region article
function getWikipediaRegion(region, countryName) {
  var url = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=" + region + "&rvprop=coordinates&callback=?";  
  $.getJSON(url, function (data) {
    var obj = data.query.pages;
    var ob = Object.keys(obj)[0];
    try{
      if(obj[ob]['extract'] !== undefined && obj[ob]['extract'].length!==0 && !obj[ob]['extract'].includes("refer to ") && !obj[ob]['extract'].includes("refers to ") && hasCountryOrRegion(obj[ob]['extract'], countryName, null)){
        showInfo(obj[ob].title, obj[ob]['extract']);
      }else{
        getWikipediaCountry(countryName);//check if there is a Wikipedia article about the country
      }
    }
    catch (error) {
      console.log(error);
    }
  });
}

//get country article
function getWikipediaCountry(countryName) {
  var url = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=" + countryName + "&rvprop=coordinates&callback=?";  
  $.getJSON(url, function (data) {
    var obj = data.query.pages;
    var ob = Object.keys(obj)[0];
    try{
      if(obj[ob]['extract'] !== undefined && obj[ob]['extract'].length !== 0){
        showInfo(obj[ob].title, obj[ob]['extract']);
      }else{
        showInfo("Sorry", "We couldn't find any Wikipedia article! Please choose a different place!");
      }
    }catch (error) {
      console.log(error);
    }
  });
}

//method that shows all of the information
function showInfo(title, text){
  //show Wikipedia article
  document.getElementById("placeName").textContent = title;
  document.getElementById("wikiText").textContent = text;
  //show weather info
  putWeatherInfo();
  weatherArray.splice(0, weatherArray.length); //remove all the elements in the array
  satelliteImageDiv.appendChild(previousImage); //show satellite image
}

//check if the Wikipedia article mentions the country or region
function hasCountryOrRegion(str, countryName, regionName){
  return str.includes(countryName) || str.includes(regionName);
}

//set up theMarker
function drawOnclick() {
  theMarker = new google.maps.Marker({
    map: map,
    position: new google.maps.LatLng(55.6050, 13.0038)
  });
}

//method that deletes all the information
function resetList(){
  var theList = document.getElementById("searchList");
  var allItems = theList.getElementsByTagName("li");
  while(allItems.length > 0){
    theList.removeChild(allItems[0]);
  }
  document.getElementById("wikiText").textContent = '';
  document.getElementById("placeName").textContent = '';
}

//fetch the satellite image
async function getSatelliteImage(lat, lon) {
  const imgUrl = "https://maps.googleapis.com/maps/api/staticmap?center=" + lat + "," + lon + "&zoom=9&size=700x700&maptype=satellite&key=AIzaSyAw-HBJXD6og94PZBLQcS6mO-cr0y1mDaA";
  const satelliteImage = document.getElementById('satellite-image');

  this.satelliteImageDiv = satelliteImage; 
  const existingImage = satelliteImage.querySelector("img");
  if (existingImage) {
    existingImage.remove(); //remove the existing image
  }
  const img = new Image();
  img.src = imgUrl;
  //show the image
  img.onload = function() {
    img.style.width = satelliteImage.offsetWidth + "px"; //set image width
    img.style.height = satelliteImage.offsetHeight + "px"; //set image height
    img.style.borderRadius="25px"; //set image borderRadius
  };
  previousImage = img; //update previousImage
}
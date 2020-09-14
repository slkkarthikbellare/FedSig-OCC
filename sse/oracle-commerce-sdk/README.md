Introduction
Oracle Cloud Commerce rest client is designed to connect to an Oracle Cloud Commerce Server from a Node.js application. 
Currently, this client supports only Storefront and admin servers’ public REST APIs and third-party application APIs for admin server. 

Now let us see how we can configure and make rest API calls using the client.

How to configure the rest SDK?
The SDK can be configured as public or third party application SDK.

Configuring Public SDK
The SDK is configured without any application key. So this instance will be used to access public rest endpoints.

var CommerceSDK = require ('commerce-rest');

var mySDK = new CommerceSDK({

               hostname : 'https://mycommercestore.com', //urls values could be 'http://mycommercestore.com:8080' or 'mycommercestore.com'

               port : '8080',  // port is optional

               logger : loggerInstance //by default, the sdk will log messages to a console and if you prefer, you can direct the log to an OTB logger

});
 

Configuring Third-Party Application SDK
This SDK is configured with application key, and this instance will be used to access any third party application accessible rest endpoints.

var CommerceSDK = require ('commerce-rest');

var mySDK = new CommerceSDK({

               hostname : 'https://mycommercestore.com', //urls values could be 'http://mycommercestore.com:9080' or 'mycommercestore.com'

               port : '9080',  // port is optional

               logger : loggerInstance //by default, the sdk will log messages to a console and if you prefer, you can direct the log to an OTB logger

               apiKey : 'my_application_key'
});

 

When a third party application makes a rest request, the SDK logins as a third party application and makes the request and the access token is preserved in the SDK instance for any further rest calls. Once the application completes all rest calls, it is advisable to log out from the Oracle Commerce Server.

 

How to make endpoint calls?
This SDK supports all CRUD operations such as get, post, put and delete. Based on the request state, these operations return errors or JSON response.

These operations include the following config options. This configuration provides necessary information to make rest endpoint calls:

url
The url config option is used to pass the rest endpoint url.

data
The data config option is used to pass any input data needed for the endpoint.

headers
The headers config option is used to pass in any custom headers such as 'x-ccasset-language'.  This header is used to pass in any asset language that is supported by an asset.

callback
The callback config option is used to pass a callback function. The callback function is called for the error and successful case.

API Requests
GET
The get request is getting product information from Oracle Commerce.

mySDK.get ({url:'/ccstore/v1/products/xprod2535', callback: function (err, response) {

               'use strict';

if (err) {

               console.log ('Got an error response from GET REQUEST' + err);

               return;

}

console.log ('Got a response from GET REQUEST.');

}

});

POST
The post request is creating a new product.

var sampleProductData = {  "categoryId": "rootCategory",  "catalogId": "cloudCatalog",

                              "properties": {

                                             "shippingSurcharge": null,

                                             "weight": "20",

                                             "width": "20",

                                             "orderLimit": "100",

                                             "taxCode": null,

                                             "id": "xProd102131",

                                             "productNumber": "p1815",

                                             "height": "20",

                                             "listPrice": "100",

                                             "description": "A Cloud Lake Product.",

                                             "length": "20",

                                             "longDescription": "This is a sample description.",

                                             "active": true,

                                             "salePrice": "80",

                                             "arrivalDate": "2014-03-16T18:30:00.000Z",

                                             "displayName": "Sample"

                              },

                              "productType": ""

};

var lang = {'x-ccasset-language' : 'en'};

 

mySDK.post ({url :'/ccadmin/v1/products', data : sampleProductData , headers : lang , callback : function (err, response) {

               'use strict';

               if (err) {

                              console.log ('Got an error response from POST REQUEST' + err);

                              return;

               }

               console.log ('Got a response from POST REQUEST');

}

});

PUT
The put request is updating an existing product.

var sampleProductUpdateData = {  "categoryId": "rootCategory",  "catalogId": "cloudCatalog",

                              "properties": {

                                             "shippingSurcharge": null,

                                             "weight": "20",

                                             "width": "20",

                                             "orderLimit": "100",

                                             "taxCode": null,

                                             "id": "xProd102131",

                                             "productNumber": "p1815",

                                             "height": "20",

                                             "listPrice": "100",

                                             "description": "A Cloud Lake Product.",

                                             "length": "20",

                                             "longDescription": "This is a sample description.",

                                             "active": true,

                                             "salePrice": "80",

                                             "arrivalDate": "2014-03-16T18:30:00.000Z",

                                             "displayName": "SamplePut"

                              },

                              "productType": ""

};

 

 

mySDK.put ({url :'/ccadmin/v1/products/xProd102131', headers : lang , data : sampleProductUpdateData , callback : function (err, response) {

               'use strict';

               if (err) {

                              console.log ('Got an error response from PUT REQUEST' + err);

                              return;

               }

               console.log ('Got a response from PUT REQUEST');

}});

DELETE
The delete request is deleting a product.

mySDK.delete ({url :'/ccadmin/v1/products/xProd102131', callback : function (err, response) {

               'use strict';

               if (err) {

                              console.log ('Got an error response from DELETE REQUEST' + err);

                              return;

               }

               console.log ('Got a response from DELETE REQUEST');

}

});

 

Logout
The logout function is used to log out the third-party application from the Oracle Commerce Server.

mySDK.logout();
//Require the dev-dependencies
var request = require('request');

//Set test server url for either server or locally
var test_server_url = process.env.EXT_SERVER_URL || "http://localhost:3000";
var base_url = test_server_url + '/ccstorex/custom/v1/calculateShipping';

console.log('base_url:', base_url); 


describe('Calculate Shipping', function() {

	var body;
	var options;
	
	beforeEach(function() {
	  console.log('Set JSON POST body before every test.');

		body = {"request": {
  "orderDiscount": 0,
  "rawOrderTotal": 2999,
  "orderTotal": 2999,
  "currencyCode": "USD",
  "items": [{
    "product": {
      "id": "porteur",
      "shippingSurcharge": null,
      "height": null,
      "weight": null,
      "width": null,
      "length": null,
      "taxCode": null
    },
    "amount": 2999,
    "rawTotalPrice": 3499,
    "quantity": 1,
    "catalogRefId": "porteur_white_small",
    "discount": 500
  }],
  "address": {
    "lastName": "Name",
    "postalCode": "02144",
    "state": "ENG",
    "address1": "1 Main",
    "address2": "",
    "firstName": "Test",
    "country": "GB"
  },
  "locale": {
    "language": "en",
    "displayName": "English",
    "country": ""
  }
}}

	options = {
		url: base_url,
		headers: {"X-Oracle-Cc-Webhook-Signature": "EXitXpTbH05ZkkFocx5hmVM8Ek0="},
		json: body
	};
	  
	});

	
	it('should be well formed post request', function(done) {
		request.post(options, function(error, response) {
			expect(response.statusCode).toBe(200);
			done();
		});
	});


	it('should be missing address', function(done) {

		//Remove address attribute
		delete body.request.address;

		options = {
			url: base_url,
			headers: {"X-Oracle-Cc-Webhook-Signature": "EXitXpTbH05ZkkFocx5hmVM8Ek0="},
			json: body
		};

		request.post(options, function(error, response) {
			expect(response.statusCode).toBe(403);
			done();
		});		
	});	


	it('should have invalid HMAC signature', function(done) {

		options = {
			url: base_url,
			headers: {"X-Oracle-Cc-Webhook-Signature": "incorrectsignature"},
			json: body
		};

		request.post(options, function(error, response) {
			expect(response.statusCode).toBe(403);
			done();
		});		
	});

	it('should have correct Basic Authentication', function(done) {

		options = {
			url: base_url,
			headers: {"Authorization": "Basic dXNlcm5hbWU6cGFzc3dvcmQ="},
			json: body
		};

		request.post(options, function(error, response) {
			expect(response.statusCode).toBe(200);
			done();
		});		
	
	});

	it('should fail Basic Authentication', function(done) {

		options = {
			url: base_url,
			headers: {"Authorization": "Basic wrong:wrong"},
			json: body
		};

		request.post(options, function(error, response) {
			expect(response.statusCode).toBe(403);
			done();
		});		

	});
	
});

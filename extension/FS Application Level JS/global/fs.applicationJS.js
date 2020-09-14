define(

  //-------------------------------------------------------------------
  // DEPENDENCIES
  //-------------------------------------------------------------------
  ['jquery', 'knockout', 'ccLogger'],

  //-------------------------------------------------------------------
  // Module definition
  //-------------------------------------------------------------------

  function($, ko, CCLogger) {
	function FSOrgContext() {
		if (FSOrgContext.singleInstance) {
			throw new Error("Cannot instantiate more than one FSOrgContext, use getInstance()");
		}
		var self = this;
		self.orgContext = {};
		self.initializeFsOrgContext= function(widget){
			var fsOrgContext = {};
			fsOrgContext.siteId = widget.site().siteInfo.id;
			var user = widget.user();
			var organizations = user.organizations();
			var profileType = 'b2c';
			if(organizations!=null && organizations.length > 0){
			  profileType = 'b2b';
			  var billToAddress = "";
			  var shipToAddress = [];
			  for(var i=0; i< user.organizationAddressBook.length;i++){
				  var oaddress = user.organizationAddressBook[i];
				  if(oaddress.fs_site_id === siteId && oaddress.is_billing_address == true ){
					billToAddress = oaddress;
				  }else if(oaddress.fs_site_id === siteId && oaddress.is_shipping_address == true){
					shipToAddress.push(oaddress);
				  }
			  }
			}
			fsOrgContext.profileType= profileType;
			fsOrgContext.jdeBillToNumber = billToAddress.jde_customer_number;
			fsOrgContext.hasActivePrice = billToAddress.jde_has_active_price;
			fsOrgContext.billToAddress = billToAddress;
			fsOrgContext.shipToaddresses = shipToAddress;
			self.orgContext = fsOrgContext;
			return fsOrgContext;
		};
		return(self);
	};
    return {
      onLoad : function () {
        CCLogger.info("Loading Demo Shared View Models");
      },
	  
	  getInstance: function() {
            if(!FSOrgContext.singleInstance) {
              FSOrgContext.singleInstance = new FSOrgContext();
            }

            return FSOrgContext.singleInstance;
      }
    };
});
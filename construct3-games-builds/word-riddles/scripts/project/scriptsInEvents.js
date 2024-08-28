

function buyIAP(product_id, success, failed){
    console.log("purchasing product");
    FBInstant.payments.purchaseAsync({
        productID: product_id,
        // developerPayload: payload,
    }).then(success).catch(failed);       
}
function consumeProduct(purchase_token, success, failed){
	console.log("purchase_token: ", purchase_token);
    FBInstant.payments.consumePurchaseAsync(purchase_token)
    .then(success).catch(failed);
}

function gettingUnConsumedProducts(success, failed){
    FBInstant.payments.getPurchasesAsync().then(success).catch(failed);
}

function loadShowBannerAd(bannerAdId, success, failed){
    FBInstant.loadBannerAdAsync(
        bannerAdId // Replace with your Ad Placement ID.
      ).then(success).catch(failed);
}

function hideBannerAd(success, failed){
FBInstant.hideBannerAdAsync().then(success).catch(failed);
}




const scriptsInEvents = {

	async Ecommon_Event10_Act1(runtime, localVars)
	{
		FBInstant.payments.purchaseAsync({
			productID: localVars.product_id,
			// developerPayload: payload,
		}).then(function(purchase){
			console.log("productID:"+ purchase.productID, ", purchaseToken: "+purchase.purchaseToken);
			if(purchase.productID!="wordriddles_removead")
		runtime.callFunction("ConsumePurchase", purchase.purchaseToken, purchase.productID);
		else {
		hideBannerAd(function(){cosole.log("hide banner success")}, function(err){cosole.log("hide banner erro: "+err);})
		runtime.callFunction("SetAdRemoved");
		}
		
		}).catch(function(error){
		console.log("Error>>>>>>", error);
		});       
	},

	async Ecommon_Event11_Act1(runtime, localVars)
	{
		console.log("Consume Product: ", localVars.purchaseToken);
		
		
		FBInstant.payments.consumePurchaseAsync(localVars.purchase_token)
							.then(function(){
								// Product consumed
								runtime.callFunction("CollectRewardOnPurchase", localVars.product_id);
								
							}).catch(function(e) {
								// Error occurred
								console.error("product consume error: "+e);
							});
	},

	async Ecommon_Event116_Act7(runtime, localVars)
	{
		FBInstant.payments.getPurchasesAsync().then(function (purchases) {
					console.log(purchases); // [{productID: '12345', ...}, ...]
					purchases.forEach(element => {
						console.log("un-consumed purchase: "+element.productID);
						FBInstant.payments.consumePurchaseAsync(element.purchaseToken)
							.then(function(){
								console.log("Product consumed", element.productID);
								
							}).catch(function(e) {
								// Error occurred
								console.error("product consume error: "+e);
							});
					});
				  });
	},

	async Ecommon_Event123_Act1(runtime, localVars)
	{
		
		FBInstant.payments.getPurchasesAsync().then(function (purchases) {
					console.log("purchases:"+purchases); // [{productID: '12345', ...}, ...]
					purchases.forEach(element => {
						console.log("un-consumed purchase: "+element.productID);
						if(element.productID=="wordriddles_removead"){
							runtime.callFunction("SetNoAds",element.productID );	
						}
					
					});
					
		console.log("BANNER ADS___________"+runtime.globalVars.IS_AD_DISABLED+":::"+runtime.globalVars.IS_AD_UNLOCKED_PURCHASED)
		if(runtime.globalVars.IS_AD_DISABLED==0 && !runtime.globalVars.IS_AD_UNLOCKED_PURCHASED)	loadShowBannerAd("605432373818032_664805104547425", function(){
		console.log("banner shown successfully");
		},function(err){
		console.log("Banner failed to show: "+err);
		}) ;
					
					
				  });
	},

	async Egameplay_Event15_Act1(runtime, localVars)
	{
		function shuffle(s) {
		  var arr = s.split('');           // Convert String to array
		  
		  arr.sort(function() {
		    return 0.5 - Math.random();
		  });  
		  s = arr.join('');                // Convert Array to string
		  return s;                        // Return shuffled string
		}
		localVars["text"] = shuffle(localVars["text"]);
	},

	async Egameplay_Event37_Act1(runtime, localVars)
	{
		localVars["returnValue"] = localVars["letter"].charCodeAt(0) - 64;
	},

	async Egameplay_Event39_Act1(runtime, localVars)
	{
		localVars["returnValue"] = String.fromCharCode(localVars["frame_no"]+64)
		
	}

};

self.C3.ScriptsInEvents = scriptsInEvents;


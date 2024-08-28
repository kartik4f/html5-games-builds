
// Import any other script files here, e.g.:
// import * as myModule from "./mymodule.js";
const INTERSTITIAL_AD_TIMER = 120;

runOnStartup(async runtime =>
{
console.log("RUN ON StartUP")
	// Code to run on the loading screen.
	// Note layouts, objects etc. are not yet available.
	runtime.globalVars.IS_INTERTITIAL_ALLOWED = false;
runtime.globalVars.INTERSTITIAL_AD_TIMER = INTERSTITIAL_AD_TIMER;
runtime.globalVars.InterstitialTimer = 118;
runtime.globalVars.Bg_Music_Vol = -20;
runtime.globalVars.IS_AD_DISABLED = 0;
runtime.globalVars.DEBUG = 0;
	var supportedAPIs = FBInstant.getSupportedAPIs();

// 	var canMakePurchases = supportedAPIs.includes('payments.getCatalogAsync'); // 
	var canMakePurchases = supportedAPIs.includes("payments.purchaseAsync");
	runtime.globalVars.IS_PURCHASE_SUPPORTED = canMakePurchases;
	if (canMakePurchases) {
		console.info("IAP supported");
	}
	else{
		console.info("IAP not supported");
	}


	
	  runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));

});



async function OnBeforeProjectStart(runtime)
{
	// Code to run just before 'On start of layout' on
	// the first layout. Loading has finished and initial
	// instances are created and available to use here.

	runtime.addEventListener("tick", () => Tick(runtime));
}

function Tick(runtime)
{
	// Code to run every tick
}


//Variables
var sectionEnd = 0;

function changeLayerMode() {
    sectionEnd = (g_sections[g_section]["start"] + g_sections[g_section]["duration"])*1000;
    //if(trackCounter > currSection.endtime) increment section and change layer
    if(trackCounter > sectionEnd){
        cameraRandomCount = 1;
        g_section++;

        layerKey = Math.floor(Math.random() * (13 - 1)) + 1;
        console.log("layer mode: " + layerKey);
    }
}

function changeColourMode() {

    if (g_beat % 32 == 0){
        colourKey = Math.floor(Math.random() * 10);
        //console.log("colour mode: " + colourKey);
    }
}

function changeFreqMode() {

    if(g_tatum % 53 == 0) {
        freqKey = Math.floor(Math.random() * (11 - 2)) + 2;
        //console.log("freq mode: " + freqKey);
    }
}
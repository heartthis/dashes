(function(global) {
    global.config = {
        graphiteUrl :   window.location.protocol + "//" + "userName:password" +  "@" + window.location.host + "/",
        statsUrl : window.location.protocol + "//" + "userName:password" + "@" + window.location.host +  "/dashes/index.html"
    };
})(window);

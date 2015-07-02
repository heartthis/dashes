(function($,global){
    "use strict";



    global.Utils = (function(){
        var self = {
            INTERVAL_1_MINUTE : 60,
            INTERVAL_1_HOUR : 3600,
            INTERVAL_1_DAY : 86400,
            INTERVAL_1_WEEK : 604800,
            INTERVAL_1_MONTH : 2592000,

            VALID_INTERVALS :[
                60,
                600,
                3600,
                86400
            ]
        };

        self.limitPath = function(path, limit) {
            return path;

            if(path.length > limit) {
                path = path.substr(- (limit - 3));
                var splitPath = path.split("." ).slice(1 );

                if( splitPath.length <= 0) {
                    path = "..." + path;
                }else {
                    path = "..." + splitPath.join(".");
                }
            }

            return path;
        };

        self.parseDate = function(datetimeStr) {
            var timestamp = Date.parse(datetimeStr);
            if(timestamp > 0) {
                return timestamp / 1000;
            }

            var datetimeArr = datetimeStr.split(" ");

            if(datetimeArr.length !== 2) {
                return 0;
            }

            var dateStr = datetimeArr[0];
            var dateArr = dateStr.split("/");
            if(dateArr.length !== 3) {
                return 0;
            }


            var timeStr = datetimeArr[1];
            var timeArr = timeStr.parse(":");
            if(timeArr.length !== 2 || timeArr.length !== 3) {
                return 0;
            }

            var d = new Date();

            d.setMonth(parseInt(dateArr[0]) - 1);
            d.setDate(parseInt(dateArr[1]));
            d.setFullYear(2000 + parseInt(dateArr[2]));


            d.setHours(parseInt(timeArr[0]));
            d.setMinutes(parseInt(timeArr[1]));
            if(timeArr.length === 3) {
                d.setSeconds(parseInt(timeArr[2]));
            }

            return d.getTime() / 1000;
        };

        self.truncateText = function() {
            var leftTruncateItems = $(".left-truncate:not(.template)");
            leftTruncateItems.each(function(i, el){


                if($(this).length && $(this).parent() && $(this).attr("data-fullText") && $(this ).is(":visible") ) {

                    if($(this).parent().width() == 0) {
                        $(this ).text("");
                    }else {

                        var text = $(this ).attr("data-fullText");
                        var origLength = text.length;
                        var currentText = $(this ).text();
                        var currentLength = currentText.length;
                        var ratio = $(this).parent().width() / $(this).width();

                        if(text != currentText || ratio < 1) { //if it ain't broke...

                            var charsToKeep = Math.max(0, Math.floor(ratio * currentLength) - 3);
                            var newLength = Math.min(origLength,  charsToKeep);

                            if(origLength == newLength) {
                                $(this ).text(text);
                            }else {
                                $(this ).text("..." + text.substr(origLength - newLength, newLength));
                            }
                        }
                    }
                }
            });
        };

        self.leftPadNumber = function(orig, digits, padding) {
            orig += "";
            if(typeof padding == "undefined") {
                padding = "0";
            }else {
                padding += "";
            }
            while(orig.length < digits) {
                orig = padding + orig;
            }

            return orig;
        };

        self.getCompactDate  = function(timestamp) { //returns a date in 24 hour format to save space :)
            var d = new Date(timestamp);
            var day = d.getDate();
            var month = d.getMonth() + 1;
            var year = d.getFullYear() % 100;

            var hour = d.getHours();
            var minute = d.getMinutes();

            return Utils.leftPadNumber(month,2)
                + "/" + Utils.leftPadNumber(day,2)
                + "/" + Utils.leftPadNumber(year,2)
                + " " + Utils.leftPadNumber(hour,2)
                + ":" + Utils.leftPadNumber( minute,2);
        };

        self.isMobile = function() {
            if( navigator.userAgent.match(/Android/i)
                || navigator.userAgent.match(/webOS/i)
                || navigator.userAgent.match(/iPhone/i)
                || navigator.userAgent.match(/iPad/i)
                || navigator.userAgent.match(/iPod/i)
                || navigator.userAgent.match(/BlackBerry/i)
                || navigator.userAgent.match(/Windows Phone/i)
                ){
                console.log("mobile");
                return true;
            }
            else {
                console.log("not mobile");
                return false;
            }
        };

        self.parseQueryString = function(url) {
            var ret = {};

            var urlSplit = url.split("?");
            if(urlSplit.length == 2) {
                var params = urlSplit[1].split("#");
                params =  params[0].split("&");
                for(var i = 0; i < params.length; i++) {
                    var paramArr = params[i].split("=");
                    if(paramArr.length == 2) {
                        ret[paramArr[0]] = decodeURIComponent(paramArr[1]);
                    }
                }
            }

            return ret;
        };

        self.setCurrentUrl = function(url) {
            var currentUrl = self.getCurrentUrl();
            if(currentUrl != url) {
                window.history.pushState({url : url}, "", url);
            }
        };

        self.getCurrentUrl =  function() {
            return document.location.toString();
        };


        return self;
    })();


})(jQuery,window);


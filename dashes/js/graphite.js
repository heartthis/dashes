(function($,global){
    "use strict";

    /**
     * Wrapper for the graphite API.
     *
     * Use this to get or set data from Graphite
     *
     */
    global.Graphite = (function() {

        /**
         * makes AJAX call to graphite server
         *
         * @param url
         * @param data
         * @param callback
         * @param options
         * @private
         */
        var _fetchUrl = function(url, data, callback, options) {
            var url = global.config.graphiteUrl + url;

            $.ajax(url, $.extend({
                async : true,
                dataType : "json",
                data : data,
                type : "GET",

                success : function(data) {
                    if(typeof callback === "function") {
                        callback(data);
                    }
                },

                error : function(data) {
                    if(typeof callback === "function") {
                        callback(data);
                    }
                }

            }, options));

        };

        /**
         * translates graphite formatted data to rickshaw's data format
         *
         * @param graphiteData
         * @returns {Array}
         * @private
         */
        var _graphiteToRickshaw = function(graphiteData) {

            var series = [];

            var palette = new Rickshaw.Color.Palette( {scheme : "munin"} );

            if(graphiteData && graphiteData.length){
                for(var j = 0; j < graphiteData.length; j++) {
                    if(graphiteData[j].hasOwnProperty("datapoints")) {
                        var chartData = [];
                        var dp = graphiteData[j].datapoints;
                        var len = dp.length;

                        for(var i = 0; i < len; i++) {
                            chartData.push({
                                x : dp[i][1],
                                y : dp[i][0] === null ? 0 : dp[i][0]
                            });
                        }

                        series[j] = {
                            data : chartData,
                            color : palette.color(),
                            name : graphiteData[j].target.split(",")[0].split("(" )[1]
                        };
                    }
                }
            }

            return series;
        };


        var _createDashFromGraphsArr = function(dashName, graphsArr, callback) {
            var url = "dashboard/save/" + encodeURIComponent(dashName);

            var state = {
                name : dashName,
                graphs : graphsArr,
                timeConfig : {},
                refreshConfig : {},
                graphSize : {},
                defaultGraphParams : {}
            };


            _fetchUrl(url,{
                state : JSON.stringify(state)
            },callback,{type : "POST"});
        };

        var _addStatsToGraphArr = function(stats, graphArr) {
            var url = "/" + self.getRenderUrl(stats);
            var targetStr = "target=" + stats.join("&target=");

            graphArr.push([
                targetStr,
                {target: stats},
                url
            ]);
        };

        var self = {

            getSeriesFromStats : function(statNames, startTs, endTs, interval, callback, useCompare, func) {
                var url = this.getRenderUrl(statNames, startTs, endTs, interval, useCompare, func) + "&format=json";

                this.getSeriesFromUrl(url,callback);
            },

            getRenderUrl : function(statNames, startTs, endTs, interval, useCompare, func) {
                var validFuncs = ["sum","avg","min","max","last"];

                if(typeof interval === "undefined") {
                    interval = Utils.INTERVAL_1_HOUR;
                }

                if(typeof useCompare === "undefined") {
                    useCompare = false;
                }

                if(validFuncs.indexOf(func) < 0) {
                    func = "sum";
                }

                if(useCompare) {
                    var compareStats = [];
                    for(var i = 0; i < statNames.length; i++) {
                        var stat = statNames[i];
                        compareStats.push('timeShift(' + stat + ', "' + (endTs - startTs) + 'second")');
                    }

                    statNames = statNames.concat(compareStats);
                }


                var url = "render?";

                if(interval) {
                    url += "target=summarize(";
                    url += statNames.join( ',"' + interval + 'second","' + func + '",true)&target=summarize(');
                    url += ',"' + interval + 'second","' + func +  '",true)';
                }else {
                    url += "target=";
                    url += statNames.join('&target=');
                }


                if(startTs) {
                    url += "&from=" + startTs;
                }
                if(endTs) {
                    url += "&until=" + endTs;
                }

                return url;
            },

            getSeriesFromUrl : function(url, callback) {
                _fetchUrl(url,{}, function(data){
                    var series = _graphiteToRickshaw(data);
                    if(typeof callback === "function") {
                        callback(series);
                    }
                }.bind(this));
            },

            getStatsFromUrl : function(url) {
                if(!url) {
                    return [];
                }

                var ret = [];
                var urlArr = url.split("?");
                if(urlArr.length !== 2) {
                    return ret;
                }

                urlArr = urlArr[1].split("&");
                for(var i = 0; i < urlArr.length; i++) {
                    var paramArr = urlArr[i].split("=");

                    if(paramArr.length === 2) {
                        if(paramArr[0] === "target") {
                            ret.push(paramArr[1]);
                        }
                    }
                }

                return ret;

            },

            queryStats : function(query, callback) {
                _fetchUrl("metrics/find/?format=completer&query=" + query,{}, callback);
            },

            getUsers : function(callback) {
                _fetchUrl("browser/usergraph/?path",{}, callback);
            },

            getChartsForUser : function(userName, callback) {
                _fetchUrl("browser/usergraph/?path=" + userName + "&query=" + userName + ".*&user=" + userName + "&node=" +userName , {}, callback);
            },

            getChart : function(userName, chartName, callback) {

                var url = "browser/usergraph/?path=" + userName +  "&query=" + userName + ".*&user=" + userName + "&node=" + userName;
                _fetchUrl(url , {}, function(data){
                    var result = {};
                    if(data) {
                        for(var i = 0; i < data.length; i++) {
                            if(data[i] && data[i].text == chartName) {
                                result = data[i];
                            }
                        }
                    }

                    if(result && result.text) {
                        if(typeof callback === "function") {
                            callback([result]);
                        }
                    }
                });
            },

            queryDashboards : function(query, callback) {
                if(typeof query === "undefined") {
                    query = "";
                }

                _fetchUrl("dashboard/find/?query=" + query, {}, callback);
            },

            getDashboardStats : function(dashboardName, callback) {

                _fetchUrl("dashboard/load/" + dashboardName, {}, callback);
            },

            saveChart : function(stats, name, callback) {
                var url = global.config.graphiteUrl  + this.getRenderUrl(stats,undefined, undefined, 0);

                var saveUrl = "composer/mygraph/?action=save&graphName="
                    + encodeURIComponent(name)
                    + "&url=" +  encodeURIComponent(url);

                _fetchUrl(saveUrl,{}, callback, {dataType : "text", type : "POST"});
            },

            deleteChart : function(name, callback) {
                var deleteUrl = "composer/mygraph/?action=delete&graphName="
                    + encodeURIComponent(name);

                _fetchUrl(deleteUrl,{}, callback, {dataType : "text", type : "POST"});
            },

            renameChart : function(stats, oldName, newName, callback) {
                this.saveChart(stats,newName,function(response){
                    if(response == "SAVED") {
                        this.deleteChart(oldName,callback);
                    }
                }.bind(this));
            },

            createDash : function(dashName, statsArr, callback) {
                var graphs = [];

                for(var i= 0; i < statsArr.length; i++) {
                    _addStatsToGraphArr(statsArr[i],graphs);
                }

                _createDashFromGraphsArr(dashName, graphs, callback);
            },

            deleteDash : function(dashName, callback) {
                _fetchUrl("dashboard/delete/" + encodeURIComponent(dashName), {"_dc" : (new Date()).getTime()}, callback);
            },

            renameDash : function(oldName, newName, statsArr, callback) {
                this.createDash(newName, statsArr, function(response) {
                    console.log(response);
                    this.deleteDash(oldName, callback);
                }.bind(this));

            },

            getLoggedInUser : function(callback) {
                _fetchUrl("account/me", {}, callback, {dataType : "text"})
            },

            getLoginUrl : function() {
                return global.config.graphiteUrl + "account/login?nextPage=" + encodeURIComponent(global.config.statsUrl);
            },

            getLogoutUrl : function() {
                return global.config.graphiteUrl + "account/logout?nextPage=" + encodeURIComponent(global.config.statsUrl);

            }
        };

        return self;
    })();



})(jQuery,window);

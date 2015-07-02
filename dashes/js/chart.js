(function($, global){
    "use strict";


    /**
     * Chart
     *
     * Handles the displays and controls for a single Chart.
     * A chart may display multiple stats an
     *
     *
     */
    global.Chart = (function(){

        var self = function(stats) {
            if(typeof stats !== "undefined") {
                this.setStats(stats);
            }

            this.graphType = "line";
            this.func = "sum";

            var now = Math.round((new Date()).getTime() / 1000);
            var start = now - 24 * 60 * 60;
            var end = now;
            var interval = Utils.INTERVAL_1_HOUR;

            this.updateDateRange(start,end,interval);
        };

        self.OPTION_SAVE_CHART = "save-chart";
        self.OPTION_DELETE_CHART = "delete-chart";
        self.OPTION_RENAME_CHART = "rename-chart";
        self.OPTION_NEW_CHART = "new-chart";

        self.OPTION_ADD_TO_DASH = "add-to-dash";
        self.OPTION_DELETE_FROM_DASH = "delete-from-dash";
        self.OPTION_FULL_SCREEN = "full-screen";
        self.OPTION_TABLE_VIEW = "table-view";
        self.OPTION_DOWNLOAD_CSV = "download-csv";


        self.MIN_DESKTOP_WIDTH = 800;

        self.MAX_DATA_POINTS = 5000;

        self.prototype.stats;
        self.prototype.seriesDirty = false;
        self.prototype.series;

        self.prototype.wrapper;
        self.prototype.container;
        self.prototype.graph;
        self.prototype.hover;
        self.prototype.legend;
        self.prototype.shelving;
        self.prototype.xAxis;
        self.prototype.yAxis;
        self.prototype.dateSelector;
        self.prototype.modeSelector;
        self.prototype.funcSelector;
        self.prototype.optionsContain;

        self.prototype.options;
        self.prototype.name;
        self.prototype.userName;
        self.prototype.title;

        self.prototype.dashboard;

        self.prototype.height;
        self.prototype.width;

        self.prototype.start;
        self.prototype.end;
        self.prototype.interval;

        self.prototype.graphType;
        self.prototype.showCompare;
        self.prototype.func;

        self.prototype.isSmall = false;

        self.prototype.load = function(noDraw, callback) {
            if(!this.seriesDirty) {
                return;
            }

            this.showLoading();


            var onStatsFetched = function() {

                if(this.stats && this.stats.length) {

                    Graphite.getSeriesFromStats(this.stats, this.start, this.end, this.interval, function(seriesData){
                        this.setData(seriesData);
                        if(!noDraw) {
                            this.draw();
                        }
                        if(typeof callback === "function") {
                            callback();
                        }

                    }.bind(this),this.showCompare, this.func);
                }else {
                    this.clear();
                }
            }.bind(this);


            if((!this.stats || !this.stats.length) && this.name && this.userName) {
                this.getStatsFromName(onStatsFetched);
            }else {
                onStatsFetched();
            }
        };

        self.prototype.getStatsFromName = function(callback) {
            Graphite.getChart(this.userName,this.name,function(data){

                if(data.length) {
                    this.stats = Graphite.getStatsFromUrl(data[0].graphUrl);

                    if(typeof callback !== "undefined") {
                        callback();
                    }
                }

            }.bind(this));
        };

        self.prototype.setOptions = function(arr) {
            this.options = arr;
        };


        self.prototype.addStat = function(stat) {
            if(!this.stats) {
                this.stats = [];
            }

            if(this.stats.indexOf(stat) < 0) {
                this.stats.push(stat);
                this.seriesDirty = true;
            }
        };

        self.prototype.removeStat = function(stat) {
            if(!this.stats) {
                return;
            }

            var i = this.stats.indexOf(stat); //doesn't work in old IE, I don't care

            if(i >= 0) {
                this.stats.splice(i,1);
                this.seriesDirty = true;
            }
        };

        self.prototype.setStats = function(stats) {
            this.stats = stats;
            this.seriesDirty = true;
        };


        self.prototype.setData = function(series) {
            this.series = series;
            this.seriesDirty = false;
        };

        self.prototype.hide = function() {
            this.container.hide();
        };

        self.prototype.show = function() {
            this.container.show();
        };

        self.prototype.clearData = function() {
            this.series = null;
            this.stats = null;
            this.name = null;
        };

        self.prototype.computeWidth = function() {
            var w = this.container.width();
            return $("body" ).is(".smallScreen") ? w : w - 30;
        };

        self.prototype.computeHeight = function() {
            var chartAndLegendHeight = this.container.height() - this.dateSelector.height() - 11;

            return chartAndLegendHeight - 30 - ( this.stats ? Math.max(60, Math.min(100, this.stats.length * 17)) : 60 );
        };

        self.prototype.clear = function() {
            if(this.wrapper) {
                this.wrapper.remove();
                this.wrapper = null;
            }

            if(this.title) {
                this.title.remove();
                this.title = null;
            }
        };

        self.prototype.softClear = function() {
            if(this.container) {
                var template =$(".chart-wrapper.template" ).find(".rickshaw-components").clone();
                this.container.find(".rickshaw-components" ).html(template.html());

               var template =$(".chart-wrapper.template" ).find(".navbar").clone();
               this.container.find(".navbar" ).html(template.html());
            }
            if(this.optionsContain) {
                this.optionsContain.find(".options-menu" ).empty();
            }
            if(this.title) {
                this.title.empty();
                this.title = null;
            }
        };

        self.prototype.showTitle = function() {
            if(!this.title && this.name) {
                this.title = this.wrapper.find(".chart-title" ).text(this.name);
                this.title.show();
            }else if(this.title && !this.name) {
                this.title.empty();
                this.title.hide();
                this.title = null;
            }
        };

        self.prototype.showLoading = function() {
            if(this.container) {
                this.container.spin({
                    lines : 7,
                    width :5,
                    length : 20,
                    radius : 15
                });

                this.container.append("<div class='shade'></div>");
            }
        };

        self.prototype.hideLoading = function() {
            if(this.container) {
                this.container.spin(false);
                this.container.find(".shade" ).remove();
            }
        };

        self.prototype.createContainer = function() {
            if(!this.wrapper) {
                var rCol = $(".right-col-inner" );
                this.wrapper = $(".chart-wrapper.template" ).clone();
                this.wrapper.removeClass("template");
                this.container = this.wrapper.find('.chart-contain');
                rCol.append(this.wrapper);
            }
        };

        self.prototype.resizeContainer = function() {

            var rCol = $(".right-col" );
            var width = 460;

            var heightLimit = 0;

            var padding = $("body" ).is(".smallScreen") ? 5 : 10;
            var titleHeight = this.title? this.title.height() + 10 : 0;

            var height = rCol.height() - $(".right-col-header" ).height() - titleHeight - 52;
            var colWidth = rCol.width(); //subtract 20 px for scrollbar

            if(this.isSmall) {
                var numCols = Math.ceil(colWidth/ 984);
                width = Math.max(width, colWidth/numCols- (2 *padding) - 30); //if screen is big enough, we can do 2 columns!
                heightLimit = .8 * width;
            }else {
                width = Math.max(width, colWidth - (2 * padding) - 45);
                heightLimit = 1.5 * width;
            }

            if($("body" ).is(".smallScreen")) {
                height -= ($(".user-panel").height() + 8);
            }

            var legend = this.container.find(".legend");
            if(legend.find(".showAll" ).length) {
                var boost = Math.max(0,legend.height() - 105);
                height += boost;
                heightLimit += boost;
            }

            height = Math.min(heightLimit, height);

            this.container.width(width);
            this.container.height(height);
        };



        self.prototype.draw = function() {
            this.hideLoading();

            if(!this.series) {
                return;
            }

            this.softClear();

            this.createContainer();
            this.showTitle();

            this._drawToolbar();

            this._initModeSelector();
            this._initFuncSelector();


            this.resizeContainer();

            var height = this.computeHeight();
            var width = this.computeWidth();

            if(!this.series || !this.series.length) {
                this.container.addClass("no-data");
                this.container.find(".chart").width(width).height(height);
                return;
            }else {
                this.container.removeClass("no-data");
            }


            this.graph = new Rickshaw.Graph( {
                element: this.container.find(".chart")[0],
                width: width,
                height: height,
                renderer : this.graphType,
                tension :.97,
                series: this.series
            } );

            this.hover = new Rickshaw.Graph.HoverDetail( {
                graph: this.graph,
                xFormatter : function(x) {
                    var d = new Date( x * 1000 );
                    var dates = [
                        "Sun",
                        "Mon",
                        "Tues",
                        "Weds",
                        "Thurs",
                        "Fri",
                        "Sat"
                    ]

                    return dates[d.getDay()] + " " +d.toLocaleString();
                }
            } );

            this.legend = new Rickshaw.Graph.Legend( {
                graph: this.graph,
                element: this.container.find('.legend')[0]
            } );

            this.container.find('.legend .more' ).click(this._expandLegendClicked.bind(this));

            this.shelving = new Rickshaw.Graph.Behavior.Series.Toggle( {
                graph: this.graph,
                legend: this.legend
            } );



            this.xAxis = new Rickshaw.Graph.Axis.Time( {
                graph: this.graph,
                timeFixture : new Rickshaw.Fixtures.Time.Local()
            } );

            this.yAxis = new Rickshaw.Graph.Axis.Y( {
                graph: this.graph,
                orientation: $("body").is(".smallScreen") ? 'right' : 'left',
                tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
                pixelsPerTick: 40,
                element: this.container.find(".y-axis")[0]
            } );

            this.xAxis.render();
            this.graph.render();
        };

        self.prototype._initModeSelector = function() {
            this.modeSelector = this.container.find(".modeSelect");

            var _this = this;
            this.modeSelector.find("a" ).on("click",function(){
                var mode = $(this).attr("data-mode");
                _this._selectMode(mode);
                _this.draw();

                return false;
            });

            this._selectMode(this.graphType);
        };

        self.prototype._selectMode = function(modeName) {
            var graphType = modeName;

            if(graphType !== this.graphType) {
                this.graphType = graphType;
            }

            this.modeSelector.find("a" ).removeClass("selected");
            this.modeSelector.find("a[data-mode='" + modeName +"']" ).addClass("selected");
        };


        self.prototype._initFuncSelector = function() {
            this.funcSelector = this.container.find(".func-select");

            this.funcSelector.val(this.func);

            var _this = this;

            this.funcSelector.on("change",function(e){
                var newFunc = $( this ).val();

                if(newFunc) {
                    _this._selectFunc(newFunc);

                    if(_this.seriesDirty) {
                        _this.load();
                    }else {
                        _this.draw();
                    }
                }
                return false;
            });

            this._selectMode(this.graphType);
        };

        self.prototype._selectFunc = function(func) {

            if(func !== this.func) {
                this.func = func;
                this.seriesDirty = true;
            }

        };



        self.prototype._drawToolbar = function() {
            var _this = this;
            this.dateSelector = this.container.find(".date-selector");
            this.dateSelector.find(".date-presets a" ).on("click",function(){
                _this.dateSelector.find("li" ).removeClass("active");
                $(this ).parent().addClass("active");
                var hourOffset = $(this ).attr("data-hours");

                var now = Math.floor((new Date()).getTime() / 1000);
                _this.updateDateRange( now - (hourOffset * 60 * 60), now);
                _this.load();

                return false;
            });

            var startInput = _this.dateSelector.find(".range-input-start" );
            var endInput = _this.dateSelector.find(".range-input-end" );
            startInput.val(Utils.getCompactDate(this.start * 1000 ));
            endInput.val(Utils.getCompactDate(this.end * 1000 ));

            var hoursOffset = Math.round((this.end - this.start) / (60 * 60));

            this.dateSelector.find("li" ).removeClass("active");
            this.dateSelector.find("li a[data-hours=" + hoursOffset + "]" ).parent().addClass("active");
            this.dateSelector.find(".range-input" ).on("change",function(e){

                var startTime = Utils.parseDate(startInput.val());

                var endTime = Utils.parseDate(endInput.val());


                if(!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
                    _this.updateDateRange(startTime, endTime);
                    _this.load();
                }else { //undo the change, bad date
                    startInput.val(Utils.getCompactDate(_this.start * 1000 ));
                    endInput.val(Utils.getCompactDate(_this.end * 1000 ));
                }
            });
            var intervalSelect = this.dateSelector.find(".interval-select" );

            intervalSelect.val(this.interval);

            intervalSelect.on("change",function(e){
                var newInterval = $(this ).val();
                if(newInterval) {
                    _this.updateDateRange(undefined,undefined, newInterval);
                    _this.load();
                }
            });

            this.optionsContain = this.container.find(".options-contain");
            if(this.options && this.options.length) {
                for(var i = 0; i < this.options.length; i++) {
                    this._initOption(this.options[i],this.optionsContain);
                }
            }else {
                this.optionsContain.hide();
            }

            this.dateSelector.find(".refresh-icon-contain" ).on("click", function(e){
                $(this ).addClass("loading")
                $(this ).spin({
                    lines : 7,
                    width: 2,
                    length : 4,
                    radius : 3,
                    corners : 0
                });

                _this.seriesDirty = true;
                _this.updateDateRange(undefined, (new Date()).getTime()/ 1000);
                _this.load();

                return false;
            });
        };

        self.prototype._expandLegendClicked = function() {
            console.log("resize!");
            this.resizeContainer();
        }

        self.prototype._initOption = function(optionType, optionsContainer) {

            var menu = optionsContainer.find(".options-menu");

            var createOption = function(name, requiresLogin, handler) {
                var row = $("<li></li>");
                var link = $("<a href='#'></a>" );


                if(!requiresLogin || global.Stats.userName) {
                    link.on("click", handler).text(name);
                }else {
                    link.text(name + " (requires login)");
                    link.addClass("disabled");
                }


                row.append(link);
                menu.append(row);
                return row;
            };


            //map dropdown options to methods
            switch(optionType) {
                case  self.OPTION_SAVE_CHART:
                    createOption("Save", true, this.onSaveClick.bind(this));
                    break;
                case self.OPTION_DELETE_CHART:
                    createOption("Delete", true, this.onDeleteClick.bind(this));
                    break;
                case self.OPTION_RENAME_CHART:
                    createOption("Rename", true, this.onRenameClick.bind(this));
                    break;
                case self.OPTION_ADD_TO_DASH:
                    createOption("Add to dash", false, this.onAddToDashClick.bind(this));
                    break;
                case self.OPTION_DELETE_FROM_DASH:
                    createOption("Remove from dash", false, this.onRemoveFromDashClick.bind(this));
                    break;
                case self.OPTION_FULL_SCREEN:
                    createOption("Full screen", false, this.onFullScreenClick.bind(this));
                    break;
                case self.OPTION_NEW_CHART:
                    createOption("New chart", false, this.onNewChartClick.bind(this));
                    break;
                case self.OPTION_TABLE_VIEW:
                    createOption("Table view", false, this.onTableViewClick.bind(this));
                    break;
                case self.OPTION_DOWNLOAD_CSV:
                    createOption("Download CSV", false, this.onDownloadCSVClick.bind(this));
                    break;
            }
        };



        self.prototype.onSaveClick = function(e) {
            if(!this.name) {
                var dialog = $(".save-dialog.template" ).clone().removeClass("template").modal();
                var input = dialog.find(".chart-name-input" ).focus();
                var saveBtn = dialog.find(".btn-save");
                var _this = this;

                input.on("keyup",function(e){
                    var name = $(this ).val();
                    if(name) {
                        saveBtn.removeAttr("disabled");
                    }else {
                        saveBtn.attr("disabled", "disabled");
                    }

                    return false;
                });

                saveBtn.on("click",function(e){
                    var name = input.val();
                    if(name && name.length > 1) {
                        _this.name = name;
                        _this.saveChart();
                    }
                });

            }else {
                this.saveChart();
            }
        };

        self.prototype.onDeleteClick = function(e) {
            var dialog = $(".delete-confirm.template" ).clone().removeClass("template");
            dialog.modal();

            var deleteBtn = dialog.find(".btn-delete");
            var _this = this;

            deleteBtn.on("click", function(){
                _this.deleteChart();
                _this.clear();
                _this.clearData();
            });

            return false;
        };

        self.prototype.onNewChartClick = function(e) {
            this.clear();
            this.clearData();

            Stats.onDisplayChange();
            Stats.updateUrlFromState();

            return false;
        };



        self.prototype.onRenameClick = function(e) {
            var dialog = $(".rename-dialog.template" ).clone().removeClass("template");
            dialog.modal();

            var renameBtn = dialog.find(".btn-rename");

            var input = dialog.find(".chart-name-input" ).val(this.name );
            var _this = this;

            input.focus();
            input.on("keyup",function(e){
                var name = $(this ).val();
                if(name && name != _this.name) {
                    renameBtn.removeAttr("disabled");
                }else {
                    renameBtn.attr("disabled", "disabled");
                }
            });

            renameBtn.on("click",function(e){
                var newName = input.val();

                if(newName && newName != _this.name) {
                    _this.renameChart(newName);
                }
            });

        };

        self.prototype.onAddToDashClick = function(e) {

            var _this = this;

            Graphite.queryDashboards(undefined,function(data){
                var dialog = $(".add-to-dash-dialog.template" ).clone().removeClass("template").modal();
                var dashboardResults = dialog.find(".dashboard-selector");
                dashboardResults.empty();
                var addBtn = dialog.find(".btn-add");
                addBtn.attr("disabled","disabled");

                if(data && data.dashboards && data.dashboards.length) {

                    for(var i = 0; i < data.dashboards.length; i++) {
                        var dashName = data.dashboards[i].name;
                        var row = $(".dashboard-result-item.template" ).clone();
                        row.removeClass("template");
                        var link = row.find(".dashboard-link" );
                        link.text(dashName );

                        row.attr("data-dashName", dashName);
                        link.on("click",function(e){
                            dashboardResults.find(".dashboard-result-item" ).removeClass("active");
                            $(this ).parent().addClass("active");
                            addBtn.removeAttr("disabled");
                        });


                        dashboardResults.append(row);
                    }
                }

                var newDashBtn = dialog.find(".btn-new-dash");
                newDashBtn.on("click",function(e){
                    Dashboard.showCreateDashDialog(_this.clone());
                });


                addBtn.click(function(e){
                    var dashName = dashboardResults.find(".active" ).attr("data-dashName");

                    if(dashName) {

                        global.Stats.setTab("dashes");
                        var dashesTab =global.Stats.getTab("dashes" );
                        dashesTab.setDashboard(dashName,function(){
                            var dash = dashesTab.getDisplay();
                            var chart = _this.clone();
                            chart.name = null;
                            dash.addChart(chart);
                            chart.draw();
                            dash.saveDash();
                        });
                    }
                });
            });

            return false;
        };

        self.prototype.onRemoveFromDashClick = function(e) {
            var dialog = $(".remove-confirm.template" ).clone().removeClass("template");
            dialog.modal();


            var _this = this;
            dialog.find(".btn-remove" ).on("click",function(e){
                var d = _this.dashboard;
                d.removeChart(_this);
                _this.clear();
                _this.clearData();
                d.saveDash();
            });
        };

        self.prototype.onFullScreenClick = function(e) {


            var chart = this.clone();
            if(global.Stats.displays["Chart"]) {
                global.Stats.displays["Chart"].clear();
            }

            global.Stats.setDisplay(chart, "Chart");
            global.Stats.setTab("events");

            chart.draw();
        };



        self.prototype.saveChart = function() {
            if(!this.stats || !this.stats.length || !this.name) {
                return;
            }


            Graphite.saveChart(this.stats, this.name,function(data){
                if(data == "SAVED") {
                    this.draw();

                    global.Stats.getTab("charts" ).addChartToList(this.stats, this.name, global.Stats.userName);
                }
            }.bind(this));
        };

        self.prototype.deleteChart = function() {
            var chartName = this.name;
            if(!chartName) {
                return;
            }

            Graphite.deleteChart(chartName, function(data){
                if(data == "DELETED") {
                    global.Stats.getTab("charts" ).removeChartFromList(chartName, global.Stats.userName);
                    global.Stats.getTab("charts" ).unselectAll();
                }
            });
        };

        self.prototype.renameChart = function(newName) {
            if(!this.stats || !this.stats.length || !this.name || !newName) {
                return;
            }

            Graphite.renameChart(this.stats, this.name, newName, function(data){
                if(data == "DELETED") {
                    global.Stats.getTab("charts" ).removeChartFromList(this.name, global.Stats.userName);
                    global.Stats.getTab("charts" ).addChartToList(this.stats, newName, global.Stats.userName);
                }

                this.name = newName;
                this.draw();
            }.bind(this));
        };

        self.prototype.onTableViewClick = function() {

        };

        self.prototype.onDownloadCSVClick = function() {
            var output = this.toCSVString();


            var blob = new Blob([output], {
                type: "text/plain;charset=utf-8;"
            });

            saveAs(blob, "dashesOutput.csv");
        };


        self.prototype.updateDateRange = function(start, end, interval) {

            var _roundToNearestInterval = function(ts, ival, roundUp) {
                //make sure these are ints
                ts = parseInt(ts);
                ival = parseInt(ival);

                var numIntervals = Math.floor(ts / ival);
                var newTime =  (numIntervals * ival);

                if(ival >= Utils.INTERVAL_1_DAY) { //position days around Pacific Time
                    newTime += (Utils.INTERVAL_1_MINUTE * (new Date()).getTimezoneOffset());
                }

                //make sure we're rounding in the right direction
                if(newTime > ts && !roundUp) {
                    newTime -= ival;
                }else if(newTime < ts && roundUp) {
                    newTime += ival;
                }

                return newTime;
            };

            if(typeof interval === "undefined") {
                interval = this.interval;
            }

            if(typeof start === "undefined") {
                start = this.start;
            }

            if(typeof end === "undefined") {
                end = this.end;
            }

            start = _roundToNearestInterval(start, interval, true);
            end = _roundToNearestInterval(end, interval, true);

            var intervalUpdated = false;

            if((end - start)/interval > self.MAX_DATA_POINTS) {
                this.showTooManyDataPoints();

                var index =  Utils.VALID_INTERVALS.indexOf(parseInt(interval));
                if(index < Utils.VALID_INTERVALS.length - 1) {
                    interval = Utils.VALID_INTERVALS[index + 1];
                    intervalUpdated = true;
                }else {
                    return;
                }
            }




            if(start !== this.start || end !== this.end || interval !== this.interval) {
                this.start = start;
                this.end = end;
                this.interval = interval;

                this.seriesDirty = true;

                if(intervalUpdated) {
                    this.dateSelector.find(".interval-select" ).val(interval ).trigger("change");
                }else {
                    Stats.updateUrlFromState();
                }
            }
        };

        self.prototype.showTooManyDataPoints = function() {
            if(this.wrapper) {
                this.wrapper.find(".error-message" ).text("Too many data points!" ).show().fadeOut(2000);
            }
        };

        self.prototype.getSeriesData = function() {
            if(!this.series) {
                return [];
            }

            //this is going to be a 2D array
            var ret = [["date"]];

            for(var i = 0; i < this.series.length;i++) {
                var data = this.series[i].data;
                ret[0].push(this.series[i].name);
                if(data) {
                    for(var j = 0; j < data.length; j++) {
                        var x = data[j].x;
                        var y = data[j].y;

                        if(ret.length <= j + 1) {
                            ret.push(
                                [
                                    (new Date(x * 1000)).toString(),
                                    y
                                ]
                            );
                        }else {
                            ret[j + 1].push(y);
                        }
                    }
                }
            }

            return ret;
        };

        self.prototype.toCSVString = function() {
            var seriesData = this.getSeriesData();

            var ret = "";
            for(var i = 0; i < seriesData.length; i++) {
                ret += seriesData[i].join(", ") + "\n";
            }

            return ret;
        };


        self.prototype.toObj = function() {
            var data = {};

            if(this.name && this.userName) {
                data.n = this.userName + "." + this.name;
            }else if(this.stats && this.stats.length) {
                data.t = this.stats.join(",");
            }else {
                return "";
            }

            if(this.start) {
                data.s = this.start;
            }
            if(this.end) {
                data.e = this.end;
            }
            if(this.interval) {
                data.i = this.interval;
            }
            if(this.graphType) {
                data.m = this.graphType;
            }

            return data;

        };

        self.fromObj = function(data) {
            var ret = null;

            if(data) {
                var stats = [];
                var name;
                var userName;

                if(data.t) {
                    stats = data.t.split(",");
                }else if(data.n) {
                    var nSplit = data.n.split(".");
                    if(nSplit.length > 1) {
                        userName = nSplit[0];
                        name = nSplit.slice(1 ).join(".");
                    }
                }

                ret = new Chart(stats);

                if(name) {
                    ret.name = name;
                }

                if(userName) {
                    ret.userName = userName;
                }

                if(data.s) {
                    ret.start = data.s;
                }
                if(data.e) {
                    ret.end = data.e;
                }
                if(data.i) {
                    ret.interval = data.i;
                }
                if(data.m) {
                    ret.graphType = data.m;
                }

                ret.setOptions([
                    Chart.OPTION_SAVE_CHART,
                    Chart.OPTION_ADD_TO_DASH,
                    Chart.OPTION_NEW_CHART,
                    Chart.OPTION_DOWNLOAD_CSV
                ]);

            }

            return ret;
        };

        self.prototype.clone = function() {
            var c = new Chart(this.stats);
            c.name = this.name;
            c.userName = this.userName;
            c.series = this.series;
            c.start = this.start;
            c.end = this.end;
            c.interval = this.interval;
            c.options = this.option;
            c.seriesDirty = false;

            return c;
        };


        return self;
    })();


})(jQuery,window);

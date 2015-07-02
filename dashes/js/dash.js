(function($,global){
    "use strict";

    /**
     * A Dashboard displays multiple Chart objects
     *
     */
    global.Dashboard = (function(){

        var self = function(name) {
            this.setName(name);
            this.charts = [];
        };

        self.OPTION_DELETE_DASH = "delete-dash";
        self.OPTION_RENAME_DASH = "rename-dash";

        self.prototype.name = null;
        self.prototype.title = null;
        self.prototype.options = null;
        self.prototype.header = null;
        self.prototype.charts = null;
        self.prototype.statsDirty = false;

        self.prototype.setName = function(name) {
            this.name = name;
            this.statsDirty = true;
        };

        self.prototype.addChart = function(chart) {
            chart.dashboard = this;

            var useLarge = false;
            if(!this.charts.length) {
                useLarge = true;
            }else if(this.charts.length == 1) {
                this.charts[0].isSmall = true; //we have a second graph, make the first one small
            }

            chart.isSmall = useLarge ? false : true;
            chart.setOptions([
                Chart.OPTION_DELETE_FROM_DASH,
                Chart.OPTION_FULL_SCREEN,
                Chart.OPTION_DOWNLOAD_CSV
            ]);

            this.charts.push(chart);
        };

        self.prototype.removeChart = function(chart) {
            var index = this.charts.indexOf(chart);
            if(index >= 0) {
                this.charts.splice(index,1);
                chart.dashboard = null;
            }

            if(this.charts.length == 1) {
                this.charts[0].isSmall = false;
            }

            Stats.updateUrlFromState();
        };

        self.prototype.load = function(noDraw, callback) {

            var loadCharts = function() {
                for(var i = 0; i < this.charts.length; i++) {
                    var chart = this.charts[i];
                    chart.load(noDraw);
                }

                if(typeof callback === "function") {
                    callback();
                }
            }.bind(this);

            if(this.name && this.statsDirty) {
                this.statsDirty = false;
                this.clear();
                this.charts = [];

                if(!noDraw) {
                    this.showTitle();
                }

                Graphite.getDashboardStats(this.name, function(data){

                    if(data && data.state && data.state.graphs && data.state.graphs.length) {
                        for(var i = 0; i < data.state.graphs.length; i++) {
                            if(data.state.graphs[i][1] && data.state.graphs[i][1].target) {

                                var chart = new Chart(data.state.graphs[i][1].target);
                                this.addChart(chart);
                            }
                        }
                    }

                    loadCharts();

                }.bind(this));

            }else {
                loadCharts();
            }
        };

        self.prototype.saveDash = function(callback) {
            if(this.name && this.charts) {
                var statsArr = [];
                for(var i = 0; i < this.charts.length; i++) {
                    statsArr.push(this.charts[i].stats);
                }

                Graphite.createDash(this.name,statsArr, callback);
            }
        };

        self.prototype.showTitle = function() {
            console.log("showTitle");
            console.log(this);
            if(!this.header) {
                this.header = $(".right-col-header" ).find(".dashboard-header");
            }
            console.log(this.options);
            if(!this.options) {
                this.options = this.header.find(".dashboard-options .options-menu");
                this.initOptions();
            }
            console.log(this.options);
            if(!this.title) {
                this.title =  this.header.find('.dashboard-title');
                this.title.text(this.name);
            }

            this.header.show();
        };

        self.prototype.draw = function() {
            if(!this.charts.length) {
                return;
            }

            this.showTitle();


            for(var i = 0; i < this.charts.length; i++) {
                this.charts[i].draw();
            }
        };

        self.prototype.initOptions = function() {
            var options = {
                "Delete Dashboard" : this.deleteDashboardClicked.bind(this),
                "Rename Dashboard" : this.renameDashboardClicked.bind(this)
            };

            for(var optionName in options) {
                if(options.hasOwnProperty(optionName)) {
                    var row = $("<li></li>");
                    var link = $("<a href='#'></a>" );
                    var handler = options[optionName];

                    link.on("click", handler).text(optionName);


                    row.append(link);
                    this.options.append(row);
                }
            }
        };

        self.prototype.deleteDashboardClicked = function() {
            var dialog = $(".delete-dash-confirm.template" ).clone().removeClass("template");
            dialog.modal();

            var deleteBtn = dialog.find(".btn-delete");
            var _this = this;

            deleteBtn.on("click", function(){
                _this.deleteDash();
                _this.clear();
            });

            return false;
        };

        self.prototype.renameDashboardClicked = function() {
            var dialog = $(".rename-dash-dialog.template" ).clone().removeClass("template");
            dialog.modal();

            var renameBtn = dialog.find(".btn-rename");

            var input = dialog.find(".dash-name-input" ).val(this.name );
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
                    _this.renameDash(newName);
                }
            });

            return false;
        };


        self.prototype.deleteDash = function() {
            var dashName = this.name;
            Graphite.deleteDash(dashName,function(response){
                Stats.getTab("dashes" ).removeDash(dashName);
            }.bind(this));
        };

        self.prototype.renameDash = function(newName) {
            if(!this.charts) {
                return;
            }

            var currentName = this.name;
            var stats = [];
            for(var i = 0; i < this.charts.length; i++) {
                stats.push(this.charts[i].stats);
            }


            Graphite.renameDash(currentName, newName, stats, function(){
                this.setName(newName);
                this.title.empty();
                this.title = null;
                this.showTitle();
                Stats.getTab("dashes" ).renameDash(currentName, newName);
            }.bind(this));
        };



        self.prototype.clear = function() {
            for(var i = 0; i < this.charts.length; i++) {
                this.charts[i].clear();
            }

            if(this.title) {
                this.title.empty();
                this.title = null;
            }

            if(this.options) {
                this.options.empty();
                this.options = null;
            }

            if(this.header) {
                this.header.hide();
                this.header = null;
            }
        };

        self.prototype.toObj = function() {
            var data = {};

            data.n = this.name;
            data.c = [];
            if(this.charts) {
                for(var i = 0; i < this.charts.length; i++) {
                    data.c.push(this.charts[i].toObj());
                }
            }

            return data;
        }

        self.fromObj = function(data) {
            var ret = null;
            if(data.n && data.c) {
                ret = new self(data.n);
                if(data.c && data.c.length) {
                    for(var i = 0; i < data.c.length; i++) {
                        var c =  Chart.fromObj(data.c[i]);
                        c.setOptions([
                            Chart.OPTION_DELETE_FROM_DASH,
                            Chart.OPTION_FULL_SCREEN,
                            Chart.OPTION_DOWNLOAD_CSV
                        ]);

                        ret.addChart(c);
                    }
                    ret.statsDirty = false;
                }
            }

            return ret;
        };

        self.showCreateDashDialog = function(chart, onCreateCallback) {
            var newDashDialog = $(".new-dash-dialog.template" ).clone().removeClass("template").modal();

            var createBtn = newDashDialog.find(".btn-save");

            var input = newDashDialog.find(".dash-name-input" );
            input.focus();

            var updateBtn = function(e){
                var name = input.val();
                if(name ) {
                    createBtn.removeAttr("disabled");
                }else {
                    createBtn.attr("disabled", "disabled");
                }
            };

            input.on("keyup",updateBtn);

            updateBtn();

            createBtn.on("click",function(e){
                var name = input.val();

                if(name) {
                    Graphite.createDash(name, [chart.stats], function(data){
                        var dash = new Dashboard(name);
                        dash.addChart(chart);
                        chart.draw();

                        dash.statsDirty = false;

                        var dashesTab = global.Stats.getTab("dashes" );


                        if(dashesTab.display) {
                            dashesTab.display.clear();
                            dashesTab.display = null;
                        }

                        global.Stats.setTab("dashes");
                        dashesTab.display = dash;

                        dash.showTitle();

                        dashesTab.addNewDash(name, true);
                    });
                }

                return false;
            });
        };


        return self;
    })();


})(jQuery,window);

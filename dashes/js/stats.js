(function($,global){
    "use strict";


    /**
     * A generic page tab on the /stats tool.
     *
     * It guarantees methods for the page navigation to call into
     *
     */
    var IStatsTab = (function(){

        var self = function(displayClassName) {
            this.displayClassName = displayClassName;
        };

        self.prototype.displayClassName = null;

        self.prototype.init = function(){};//abstract

        self.prototype.onShow = function() {
            Stats.setDisplayClass(this.displayClassName);
        };

        self.prototype.onHide = function(nextTab) {

        };

        self.prototype.onResize = function() {

        };

        /**
         * Since tabs can share the same display, this method allows us to update each tab when the display is modified
         */
        self.prototype.onDisplayChange = function() {

        };

        self.prototype.getDisplay = function() {
            return Stats.getDisplay(this.displayClassName);
        };


        return self;
    })();


    /**
     * Represents the SearchTab singleton.
     *
     * This tab allows the user to search and select stats.
     * Results will be displayed in a Chart.
     *
     */
    var SearchTab = (function() {
        var PREFIX = "stats.counters.";
        var SUFFIX = ".count";
        var MIN_CHARS = 3;


        //display objectes
        var container;
        var resultSet;
        var input;
        var template;
        var selectBtn;
        var unselectAllBtn;
        var selectAllBtn;
        var newStatBtn;

        //is the waiting spinner active
        var spinning;

        // setTimeout id for reference
        var timeoutId;


        //caches stats queries
        var cache = {};


        var _updateSelectButton = function() {
            var checked = resultSet.find("input[type='checkbox']:checked");
            var unchecked = resultSet.find("input[type='checkbox']:not(:checked)");
            if(checked.length) {
                selectBtn.removeAttr("disabled");
                unselectAllBtn.removeAttr("disabled");
            }else {
                selectBtn.attr("disabled","disabled");
                unselectAllBtn.attr("disabled","disabled");
            }

            if(unchecked.length) {
                selectAllBtn.removeAttr("disabled");
            }else {
                selectAllBtn.attr("disabled","disabled");
            }


        };

        var _clearOutUnselectedStats = function() {
            resultSet.find(".search-result-item" ).each(function(index, item){
                if(!$(item).find("input[type='checkbox']" ).prop("checked")) {
                    $(item).remove();
                }
            });
        };

        //waits 1 second since the last key was struck to start searching
        var _handleStatSearchKeyup = function() {
            if(timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(function(){
                _doSearch();
            }, 1000);

        };


        var _doSearch = function(){
            _clearOutUnselectedStats();


            var query = "";
            var filters = [];
            var split = input.val().split("*");

            if(split.length > 0) {
                query = split[0];
                filters = split.slice(1 );
            }

            if(query.indexOf(PREFIX) !== 0) {
                query = PREFIX + query;
            }

            if(query.length < PREFIX.length + MIN_CHARS) {
                return; //3 char minimum query
            }

            if(query.charAt(query.length - 1) !== "*") {
                query += "*";
            }

            _recursiveQueryStats(query, function(stats){
                var finalStats = [];

                if(filters && filters.length) {
                    for(var i = 0; i < stats.length; i++) {
                        var lastIndex = 0;
                        var stat = stats[i];
                        var skip = false;


                        for(var j = 0; j < filters.length; j++) {
                            var filter = filters[j];

                            var newIndex = stat.indexOf(filter);
                            if(newIndex > lastIndex) {
                                lastIndex = newIndex;
                            }else {
                                skip = true;
                                break;
                            }

                        }

                        if(!skip) {
                            finalStats.push(stat);
                        }
                    }
                }else {
                    finalStats = stats;
                }

                _onStatsReturned(finalStats);
            });
        };

        /**
         * Asks the server for stats with the given directory prefix.
         * The server will return a list of subdirectories and stats.
         * Recursively calls itself on subdirectories/
         *
         * @param query
         * @param callback
         * @private
         */
        var _recursiveQueryStats = function(query, callback) {
            if(cache.hasOwnProperty(query)) {
                callback(cache[query]);
                return;
            }

            var foundStats = [];
            var toQuery = [];

            var numComplete = 0;


            var onComplete = function(newStats) {
                if(newStats && newStats.length > 0) {
                    foundStats = foundStats.concat(newStats);
                }

                if(++numComplete === toQuery.length) {
                    cache[query] = foundStats;
                    callback(foundStats);
                }
            };

            if(!spinning) {
                $(".search-loader").spin({
                    lines : 7,
                    width: 2,
                    length : 4,
                    radius : 3,
                    corners : 0
                });
                spinning = true;
            }
            Graphite.queryStats(query,function(result){
                var data = result.metrics;
                if(data && data.length) {
                    for(var i = 0; i < data.length; i++) {
                        var result = data[i];

                        if(parseInt(result.is_leaf)) {
                            foundStats.push(result.path);
                        }else {
                            toQuery.push(result.path);
                        }
                    }
                }


                if(toQuery.length > 0) {
                    for(var i = 0; i < toQuery.length; i++) {
                        _recursiveQueryStats(toQuery[i],onComplete);
                    }
                }else {
                    cache[query] = foundStats;
                    callback(foundStats);
                }
            });
        };

        /**
         * Callback when stats are returned
         *
         * @param foundStats
         * @private
         */
        var _onStatsReturned = function(foundStats) {
            for(var i = 0; i < foundStats.length; i++) {
                var item = _getResultItem(foundStats[i]);
                if(!$.contains(resultSet[0], item[0])) {
                    resultSet.append(item);
                }
            }

            spinning = false;
            $(".search-loader").spin(false);

            Utils.truncateText();
            _updateSelectButton();
        };

        var _getResultItem = function(path,checked) {

            var resultItem = resultSet.find(".search-result-item[data-path='" + path + "']");
            var checkBox;

            if(!resultItem.length) {
                resultItem = template.clone();

                var easyPath = path.indexOf(PREFIX) === 0 ? path.substr(PREFIX.length) : path;
                easyPath = easyPath.indexOf(SUFFIX) === easyPath.length - SUFFIX.length ? easyPath.slice(0, -SUFFIX.length) : easyPath;

                var limitedPath = Utils.limitPath(easyPath, 38);

                var link = resultItem.find(".stat-link");

                resultItem.removeClass("template");

                link.text(limitedPath);
                link.attr("data-fullText",easyPath);

                resultItem.show();
                resultItem.attr("data-path", path);

                checkBox = resultItem.find("input[type='checkbox']" );

                link.on("click",function(e){

                    checkBox.prop("checked", !checkBox.prop("checked"));
                    checkBox.change();

                    return false;
                });

                checkBox.on("change",function(e){
                    if($(this ).prop("checked")) {
                        self.addStatToChart(path);
                    }else {
                        self.removeStatFromChart(path);
                    }

                    _updateSelectButton();
                });
            }else {
                checkBox = resultItem.find("input[type='checkbox']" );
            }

            if(typeof checked !== "undefined") {
                if(checked) {
                    checkBox.prop("checked","checked");
                }else {
                    checkBox.removeAttr("checked");
                }
            }

            return resultItem;
        };


        var self = $.extend(  new IStatsTab("Chart"), {
            init : function() {
                container = $(".left-col-contain.search");
                resultSet = container.find(".easy-stat-search-result-set");
                input = container.find('.easy-stat-search-input');
                template = $(".search-result-item.template");
                selectBtn = container.find(".easy-select-stat-btn" );
                unselectAllBtn = container.find(".btn-unselect-all" );
                selectAllBtn = container.find(".btn-select-all" );
                newStatBtn = container.find(".btn-stat" );


                input.on('keyup', _handleStatSearchKeyup)
                    .on('focus', _handleStatSearchKeyup);

                selectBtn.on("click",function(e){
                    global.Stats.toggleColumn();
                });

                unselectAllBtn.click(function(e){
                    this.clearAllStats();
                }.bind(this));
                selectAllBtn.click(function(e){
                   this.selectAllStats();
                }.bind(this));

                newStatBtn.click(function(e){
                    CreateStatModal.show();
                });
            },

            onDisplayChange : function() {
                var stats = this.getDisplay().stats;

                if(stats && stats.length) {
                    this.setSelectedStats(stats);
                }else {
                    this.setSelectedStats([]);
                }
            },

            setSelectedStats : function(stats) {
                resultSet.find(".search-result-item" ).each(function(index, item){
                    if(stats.indexOf($(item).data("path")) < 0) {
                        $(item).find("input[type='checkbox']" ).removeAttr("checked");//uncheck things not in the list
                    }
                });

                for(var i = 0; i < stats.length; i++) {
                    var resultItem = _getResultItem(stats[i],true);
                    if(!$.contains(resultSet[0], resultItem[0])) {
                        resultSet.append(resultItem);
                    }
                }

                _handleStatSearchKeyup();
                _updateSelectButton();
            },

            clearAllStats : function() {
                this.setSelectedStats([]);
                var chart = this.getDisplay();
                chart.setStats([]);
                chart.load();

                Stats.onDisplayChange([this]);
            },

            selectAllStats : function() {
                var allStats = [];
                resultSet.find(".search-result-item" ).each(function(index,item){
                    allStats.push($(item).data("path"));
                });

                this.setSelectedStats(allStats);

                var chart = this.getDisplay();
                chart.setStats(allStats);
                chart.load();

                Stats.onDisplayChange([this]);
            },

            addStatToChart : function(stat) {
                var chart = this.getDisplay();
                chart.setOptions([
                    Chart.OPTION_SAVE_CHART,
                    Chart.OPTION_ADD_TO_DASH,
                    Chart.OPTION_NEW_CHART,
                    Chart.OPTION_DOWNLOAD_CSV
                ]);

                chart.addStat(stat);
                chart.load();

                Stats.onDisplayChange([this]);
            },

            removeStatFromChart : function(stat) {

                var chart = this.getDisplay();
                chart.setOptions([
                    Chart.OPTION_SAVE_CHART,
                    Chart.OPTION_ADD_TO_DASH,
                    Chart.OPTION_NEW_CHART,
                    Chart.OPTION_DOWNLOAD_CSV
                ]);

                chart.removeStat(stat);
                chart.load();

                Stats.onDisplayChange([this]);
            }

        });

        return self;

    })();













    /**
     * Handles logic for the events tab.
     *
     * Most of the logic manages the typeahead search.
     *
     * Displays results in a Chart
     *
     */
    var EventsTab = (function() {

        var container;
        var resultSet;
        var input;
        var template;
        var selectBtn;
        var unselectAllBtn;
        var selectAllBtn;
        var newStatBtn;
        var typeaheadResultSet;
        var inputContain;

        var _handleStatSearchKeyup = function(e) {

            var menu = $(".stat-search-input-contain" ).find(".typeahead-result-set");
            var activeRow = menu.find(".typeahead-result-item.active");

            var code = e.keyCode || e.which;
            if(code == 13) { //enter pressed, use active

                if(activeRow.length) {
                    _populateSearchWithResultRow(activeRow);
                }

            }else if(code == 40) { // down arrow pressed, move active result down
                if(activeRow.length) {
                    var nextSibling  = activeRow.next();
                    if(nextSibling.length) {
                        activeRow.removeClass("active");
                        nextSibling.addClass("active");
                    }
                }

            }else if(code == 38) { // up arrow pressed, move active result up
                if(activeRow.length) {
                    var prevSibling  = activeRow.prev();
                    if(prevSibling.length) {
                        activeRow.removeClass("active");
                        prevSibling.addClass("active");
                    }
                }
            }else { //some other key
                var query = $(this ).val();

                if(!query.charAt(-1) == "*") {
                    query += "*";
                }

                Graphite.queryStats(query, _onStatResultsReturned);
            }

        };

        var _onStatResultsReturned = function(result) {
            typeaheadResultSet.empty();
            resultSet.find(".search-result-item" ).each(function(index, item){
                if(!$(item).find("input[type='checkbox']" ).prop("checked")) {
                    $(item).remove();
                }
            });

            var data = result.metrics;
            var showMenu = false;

            for(var i = 0; i < data.length; i++) {
                var result = data[i];
                if(parseInt(result.is_leaf)) {
                    if(!resultSet.find(".search-result-item[data-path='" + result.path + "']" ).length) {
                        var resultItem = _initResultItem(result.path);
                        resultSet.append(resultItem);
                    }
                }else {
                    var resultItem = _initTypeaheadResultItem(result.path);
                    typeaheadResultSet.append(resultItem);
                    if(!showMenu) {
                        resultItem.addClass("active");
                    }
                    showMenu = true;
                }
            }

            if(showMenu) {
                typeaheadResultSet.show();
            }else {
                typeaheadResultSet.hide();
            }

            _updateSelectButton();
            Utils.truncateText();
        };

        var _updateSelectButton = function() {
            var checked = resultSet.find("input[type='checkbox']:checked");
            var unchecked = resultSet.find("input[type='checkbox']:not(:checked)");
            if(checked.length) {
                selectBtn.removeAttr("disabled");
                unselectAllBtn.removeAttr("disabled");
            }else {
                selectBtn.attr("disabled","disabled");
                unselectAllBtn.attr("disabled","disabled");
            }

            if(unchecked.length) {
                selectAllBtn.removeAttr("disabled");
            }else {
                selectAllBtn.attr("disabled","disabled");
            }


        };

        var _initResultItem = function(path) {

            var resultItem = template.clone();

            var limitedPath = Utils.limitPath(path, 38);

            var link = resultItem.find(".stat-link" );

            resultItem.removeClass("template");
            link.text(limitedPath);
            link.attr("data-fullText",path);

            resultItem.show();
            resultItem.attr("data-path", path);

            var checkBox = resultItem.find("input[type='checkbox']" );

            link.on("click",function(e){

                checkBox.prop("checked", !checkBox.prop("checked"));
                checkBox.change();

                return false;
            });

            checkBox.on("change",function(e){
                if($(this ).prop("checked")) {
                    self.addStatToChart(path);
                }else {
                    self.removeStatFromChart(path);
                }

                _updateSelectButton();
            });


            return resultItem;
        };

        var _initTypeaheadResultItem = function(path) {
            var resultItemTemplate = $(".typeahead-result-item.template");
            var resultItem = resultItemTemplate.clone();

            var limitedPath = Utils.limitPath(path, 38);

            resultItem.removeClass("template");
            resultItem.find(".typeahead-result-text" ).text(limitedPath).attr("data-fullText",path);
            resultItem.attr("data-path", path);
            resultItem.show();

            resultItem.on("click",function(e){
                _populateSearchWithResultRow($(this));

                return false;
            });

            return resultItem;
        };

        var _populateSearchWithResultRow = function(resultRow) {
            var text = resultRow.attr("data-path");
            var input = $('.stat-search-input' );
            input.val(text);
            input.focus();
            input.keyup();
        };

        var self = $.extend(  new IStatsTab("Chart"), {

            init : function() {
                container = $(".left-col-contain.events")
                inputContain = container.find(".stat-search-input-contain");
                typeaheadResultSet = inputContain.find(".typeahead-result-set");
                resultSet = container.find(".stat-search-result-set");
                input = inputContain.find('.stat-search-input');
                template = $(".search-result-item.template");
                selectBtn = container.find(".select-stat-btn" );
                unselectAllBtn = container.find(".btn-unselect-all" );
                selectAllBtn = container.find(".btn-select-all" );
                newStatBtn = container.find(".btn-stat" );

                input
                    .on('keyup', _handleStatSearchKeyup)
                    .on('focus', _handleStatSearchKeyup);

                $("body").on("click",function(e){
                    if( !$( e.target ).closest(".stat-search-input-contain" ).length ) {
                        typeaheadResultSet.hide();
                    }
                });

                selectBtn.on("click",function(e){
                    global.Stats.toggleColumn();
                });

                unselectAllBtn.click(function(e){
                    this.clearAllStats();
                }.bind(this));

                selectAllBtn.click(function(e){
                    this.selectAllStats();
                }.bind(this));

                newStatBtn.click(function(e){
                   CreateStatModal.show();
                });
            },

            onDisplayChange : function() {
                var stats = this.getDisplay().stats;

                if(stats && stats.length) {
                    this.setSelectedStats(stats);
                }else {
                   this.setSelectedStats([]);
                }
            },

            setSelectedStats : function(stats) {
                resultSet.empty();
                typeaheadResultSet.hide();

                for(var i = 0; i < stats.length; i++) {
                    var resultItem = _initResultItem(stats[i]);
                    resultItem.find("input[type='checkbox']" ).prop("checked", "checked");
                    resultSet.append(resultItem);
                }

                Utils.truncateText();
                _updateSelectButton();
            },

            clearAllStats : function() {
                this.setSelectedStats([]);
                var chart = this.getDisplay();
                chart.setStats([]);
                chart.load();

                Stats.onDisplayChange([this]);
            },

            selectAllStats : function() {
                var allStats = [];
                resultSet.find(".search-result-item" ).each(function(index,item){
                    allStats.push($(item).data("path"));
                });

                this.setSelectedStats(allStats);

                var chart = this.getDisplay();
                chart.setStats(allStats);
                chart.load();

                Stats.onDisplayChange([this]);
            },

            addStatToChart : function(stat) {
                var chart = this.getDisplay();
                chart.setOptions([
                    Chart.OPTION_SAVE_CHART,
                    Chart.OPTION_ADD_TO_DASH,
                    Chart.OPTION_NEW_CHART,
                    Chart.OPTION_DOWNLOAD_CSV
                ]);

                chart.addStat(stat);
                chart.load();

                Stats.onDisplayChange([this]);
            },

            removeStatFromChart : function(stat) {

                var chart = this.getDisplay();
                chart.setOptions([
                    Chart.OPTION_SAVE_CHART,
                    Chart.OPTION_ADD_TO_DASH,
                    Chart.OPTION_NEW_CHART,
                    Chart.OPTION_DOWNLOAD_CSV
                ]);

                chart.removeStat(stat);
                chart.load();

                Stats.onDisplayChange([this]);
            }
        });

        return self;
    })();













    /**
     * Handles selection and display of saved charts
     *
     */
    var ChartsTab = (function(){

        var _usersToCharts = {};

        var _onChartClicked = function(e){
            $(".chart-user-group" ).find(".chart-result-item").removeClass("active");
            var parent = $(this ).parent();
            parent.addClass("active");

            self.showChart(parent.attr("data-url"), parent.attr("data-name"), parent.attr("data-userId"));

            global.Stats.toggleColumn();
        };

        var _addChartToUserlist = function(userRow, url, chartName) {
            var resultSet = userRow.find(".chart-result-set" );

            var resultRow = $(".chart-result-item.template" ).clone();
            resultRow.removeClass("template");
            resultRow.attr("data-url", url);
            resultRow.attr("data-name", chartName);
            resultRow.attr("data-userId", userRow.attr("data-userId"));

            var link = resultRow.find(".chart-link");
            link.text( chartName ).attr("data-fullText", chartName);

            resultSet.append(resultRow);

            link.on("click",_onChartClicked);
        }

        var _populateResultList = function(userId, data) {
            var row = $(".chart-user-group[data-userId='" + userId + "']");

            if(data && data.length) {
                for(var i = 0; i < data.length; i++) {
                    _addChartToUserlist(row, data[i].graphUrl, data[i].text);
                }
            }

            Utils.truncateText();
        };

        var _initUserRow = function(userName, id) {
            var userRow = $(".chart-user-group.template" ).clone();
            userRow.removeClass("template");

            var toggle = userRow.find(".user-name-toggle");
            toggle.find(".user-name" ).text(userName);
            userRow.attr("data-userId", id);

            toggle.on("click",function(e) {
                userRow.find(".chart-result-set" ).toggle();

                if(!_usersToCharts.hasOwnProperty(id)) {
                    Graphite.getChartsForUser(id, function(data){
                        _usersToCharts[id] = data;
                        _populateResultList(id,data);
                    });
                }

                return false;
            });

            return userRow;
        };


        var _onUsersReturned = function(data) {
            if(data && data.length) {
                var userResults = $(".chart-users");

                for(var i = 0; i < data.length; i++) {
                    var userRow = _initUserRow(data[i].text, data[i].id);

                    userResults.append(userRow);
                }
            }
        };


        var self = $.extend(new IStatsTab("Chart"), {

            init : function() {
                Graphite.getUsers( _onUsersReturned);
            },

            onDisplayChange : function() {
                var name = this.getDisplay().name;
                var userName = this.getDisplay().userName;

                if(name && userName) {
                    //do nothing right now
                }
            },

            showChart : function(url,name, userName) {
                if(this.display) {
                    this.display.clear();
                }

                var stats = Graphite.getStatsFromUrl(url);
                var chart = self.getDisplay();
                chart.setOptions([
                    Chart.OPTION_DELETE_CHART,
                    Chart.OPTION_RENAME_CHART,
                    Chart.OPTION_ADD_TO_DASH,
                    Chart.OPTION_NEW_CHART,
                    Chart.OPTION_DOWNLOAD_CSV
                ]);

                chart.name = name;
                chart.userName = userName;
                chart.setStats(stats);
                chart.load();

                global.Stats.onDisplayChange([this]);
            },



            addChartToList : function(stats, chartName, userName) {
                var row = $(".chart-user-group[data-userId='" + userName + "']");

                if(row.length) {
                    if(_usersToCharts.hasOwnProperty(userName)) {
                        var url = Graphite.getRenderUrl(stats, undefined, undefined, 0);
                        _usersToCharts[userName] = [{
                            graphUrl : url,
                            text : chartName
                        }];

                        _addChartToUserlist(row, url, chartName);
                        Utils.truncateText();
                    }
                }else {
                    var userResults = $(".chart-users");
                    var userRow = _initUserRow(userName, userName);

                    userResults.append(userRow);
                }
            },

            removeChartFromList : function(chartName, userName) {
                var row = $(".chart-user-group[data-userId='"
                    + userName + "'] .chart-result-item[data-name='"
                    + chartName + "']");

                if(row.length) {
                    row.remove();
                }

                for(var i = 0; i < _usersToCharts.length; i++) {
                    if(_usersToCharts[i].text == chartName) {
                        _usersToCharts.splice(i,1);
                    }
                }
            },

            unselectAll : function() {
                $(".chart-user-group" ).find(".chart-result-item").removeClass("active");

                Stats.onDisplayChange([this]);
            },

            selectChart : function(chartName, userName) {
                this.unselectAll();

                var row = $(".chart-user-group[data-userId='"
                    + userName + "'] .chart-result-item[data-name='"
                    + chartName + "']");

                row.addClass("active");

                Stats.onDisplayChange([this]);
            }

        });
        return self;
    })();












    /**
     * Handles selection of dashboards.
     *
     */
    var DashesTab = (function(){


        var _initDashboardResultRow = function(dashName) {
            var row = $(".dashboard-result-item.template" ).clone();
            row.removeClass("template");
            var link = row.find(".dashboard-link" );
            link.text(dashName ).attr("data-fullText", dashName);

            row.attr("data-dashName", dashName);

            var resultSet =  $(".dashboard-result-set" );
            resultSet.append(row);

            link.on("click",function(e){
                self.setDashboard(dashName);
                resultSet.find(".dashboard-result-item" ).removeClass("active");
                $(this ).parent().addClass("active");

                global.Stats.toggleColumn();

                return false;
            });

            return row;
        };

        var _onDashboardQueryReturned = function(data) {
            if(data && data.dashboards) {
                for(var i = 0; i < data.dashboards.length; i++) {
                    _initDashboardResultRow(data.dashboards[i].name);
                }
            }
            Utils.truncateText();
        };

        var self = $.extend(new IStatsTab("Dashboard"), {

            init : function() {
                Graphite.queryDashboards(undefined, _onDashboardQueryReturned)
            },

            setDashboard : function(dashName,callback) {
                var dash = this.getDisplay();
                dash.setName(dashName);

                dash.load(false, callback);

                global.Stats.onDisplayChange([this]);
            },

            addNewDash : function(dashName, isSelected) {
                var row = _initDashboardResultRow(dashName);

                Utils.truncateText();

                if(isSelected) {
                    $(".dashboard-result-set" ).find(".dashboard-result-item" ).removeClass("active");
                    row.addClass("active");
                }

            },

            renameDash : function(oldName, newName) {
                var row = $(".dashboard-result-set" ).find(".dashboard-result-item[data-dashname='" + oldName +"']");
                row.data("dashname",newName);
                row.find(".dashboard-link" ).data("fullltext", newName ).text(newName);

                global.Stats.onDisplayChange([this]);
            },

            removeDash : function(dashName) {
                var row = $(".dashboard-result-set" ).find(".dashboard-result-item[data-dashname='" + dashName +"']");
                row.remove();

                global.Stats.onDisplayChange([this]);
            }
        });
        return self
    })();


    var CreateStatModal = (function(){

        var _dialog;
        var _testButton;
        var _eventRowContain;
        var _saveButton;
        var _variableRowCount;
        var _tab;

        var _variables;


        var _parseEquation = function(eq) {

            eq = eq.replace(/\s/, "");


            for(var i = 0; i < _variables.length; i++) {
                eq = eq.replace("$" + i, _variables[i]);
            }


            return eq;
        };

        var _createEventRow = function(index, statName) {
            var row = _eventRowContain.find(".variable-row.template").clone().removeClass("template");

            row.find(".variable-name" ).text("$" + (++_variableRowCount) +  " = ");
            row.find(".event-selector" ).text(statName);

            return row;
        };


        return {
            show : function() {

                _variableRowCount = 0;

                _tab = Stats.getCurrentTab();
                var stats;
                if(_tab.getDisplay()&& _tab.getDisplay().stats) {
                    stats = _tab.getDisplay().stats;
                }else {
                    return;
                }

                console.log(stats);

                _dialog =  $(".create-stat-modal.template" ).clone().removeClass("template").modal();
                _eventRowContain = _dialog.find(".define-variables");
                _variables = stats;

                for(var i = 0; i < stats.length; i++) {
                    var stat = stats[i];

                    var eventRow = _createEventRow(i, stat);
                    _eventRowContain.append(eventRow);
                }


                _testButton = _dialog.find(".btn-test");
                _testButton.click(function(){
                     this.testEquation();
                }.bind(this));

                _saveButton = _dialog.find(".btn-save-stat");
                _saveButton.click(function(){
                    this.saveStat();
                }.bind(this));


            },

            saveStat : function() {

                var statName = _dialog.find(".stat-name" ).val();


                var stat = _parseEquation(_dialog.find(".equation-input" ).val());


                if(stat && statName) {

                    stat = "alias(" + stat + ",'" + statName + "')";

                    _tab.addStatToChart(stat);

                }


            },

            testEquation : function() {
                var stat = _parseEquation(_dialog.find(".equation-input" ).val());

                console.log(stat);


                Graphite.getSeriesFromStats([stat],undefined,undefined,undefined,function(response){
                    console.log(response)
                });

            },


        };
    })();


    /**
     * Main class for this tool. Manages tabbing and toggling of states.
     *
     */
    global.Stats = (function(){

        var MIN_WIDTH = 500;
        var MIN_LEFT_COL_WIDTH = 362;


        var _onWindowResize = function(e) {

            var body = $("body");
            var isSmallScreen = body.is(".smallScreen");
            if($(window).width() <= 800 || Utils.isMobile()) {
                if(!isSmallScreen) {
                    body.addClass("smallScreen");
                    $(".right-col" ).hide();
                    $(".left-col" ).show();
                    $(".right-col" ).css("margin-left", "0");
                    $(".left-col" ).css("width","100%");
                }
            }else {
                if(isSmallScreen) {
                    body.removeClass("smallScreen");
                    $(".right-col" ).show();
                    $(".left-col" ).show();
                    $(".right-col" ).css("margin-left", "362px");
                    $(".left-col" ).css("width","362px");
                }
            }

            Utils.truncateText();

            global.Stats.getCurrentDisplay().draw();//redraw UI
            global.Stats.getCurrentTab().onResize();
        };

        var _onNavClicked = function(e) {

            global.Stats.setTab( $(this ).attr("data-nav"));

            Stats.updateUrlFromState();

            return false;
        };

        //window resizer
        var _grabberMouseDown = false;
        var _lastMousePosition = 0;

        var _onColGrabberMouseDown = function(e) {
            _grabberMouseDown = true;
            _lastMousePosition = e.pageX;
        };

        var _onColGrabberMouseUp = function(e) {
            _grabberMouseDown = false;
        };

        var _onGrabberMouseMove = function(e) {
            if(_grabberMouseDown) {
                var x = e.pageX;

                var lc = $(".left-col" );
                var deltaX = x - _lastMousePosition;

                var width = lc.width();
                if(width + deltaX < MIN_LEFT_COL_WIDTH) {
                    deltaX = MIN_LEFT_COL_WIDTH - width;
                }
                lc.width(width + deltaX);

                var rc = $(".right-col");

                var deltaXStr = "";
                if(deltaX < 0) {
                    deltaXStr = "-=" + (deltaX + "").substr(1);
                }else {
                    deltaXStr = "+=" + deltaX;
                }

                rc.css("margin-left",  deltaXStr);

                _lastMousePosition = x;
                _onWindowResize(e);
            }
        };

        //displays panel in upper-right corner to show who we're logged in as
        var _showUserPanel = function(userName) {
            var userPanel = $(".user-panel");
            userPanel.show();

            if(userName) {
                var logoutUrl = Graphite.getLogoutUrl();
                userPanel.find(".logout-link" ).attr("href", logoutUrl).show();
                userPanel.find(".login-link" ).hide();
                userPanel.find(".user-name" ).text(userName )
                userPanel.find(".logged-in-as" ).show();
            }else {
                var loginUrl = Graphite.getLoginUrl();
                userPanel.find(".logout-link" ).hide();
                userPanel.find(".login-link" ).attr("href",loginUrl).show();
                userPanel.find(".logged-in-as" ).hide();
            }
        };


        var self = {

            tabs : {
                search : SearchTab,
                events : EventsTab,
                charts : ChartsTab,
                dashes : DashesTab
            },

            currentTabKey : "search",

            displays : {
                Chart : null,
                Dashboard : null
            },
            currentDisplayClass : "Chart",

            userName : null,


            init : function(){

                var w = $(window);

                //there's no way to resize the screen on mobile, no need for this
                if(!Utils.isMobile()) {
                    w
                        .on("resize",_onWindowResize)
                        .on("mousemove",_onGrabberMouseMove)
                        .on("mouseup",_onColGrabberMouseUp);
                }

                //enforce a min width
                if( w.width() < MIN_WIDTH) {
                    $("#view-port" ).attr("content", "width=" + MIN_WIDTH + ", user-scalable=no");
                }

                $(".nav-pills a" ).on("click",_onNavClicked);



                $(".left-col-grabber" ).on("mousedown",_onColGrabberMouseDown)

                $(".back-btn" ).on("click",function(e){
                    self.toggleColumn();
                    return false;
                });

                //ask server for logged in user
                Graphite.getLoggedInUser(function(data){
                    if(data){
                        this.userName = data;
                    }

                    _showUserPanel(this.userName);

                }.bind(this));


                //initialize tabs
                for(var key in this.tabs) {
                    if(this.tabs.hasOwnProperty(key)) {
                        this.tabs[key].init();
                    }
                }


                //initialize state if stored in url
                this.fromUrl();

                //update component sizes to the current window size
                _onWindowResize(undefined);

                //display current tab
                this.getCurrentTab().onShow();
            },

            getCurrentTab : function() {
                return this.getTab(this.currentTabKey);
            },

            getTab : function(tabKey) {
                return this.tabs[tabKey];
            },

            setTab : function(tabKey) {

                if(this.tabs.hasOwnProperty(tabKey) && this.currentTabKey != tabKey) {
                    $(".left-col-contain").hide();
                    $(".left-col-contain." + tabKey).show();

                    this.tabs[this.currentTabKey].onHide(this.tabs[tabKey]);
                    this.tabs[tabKey].onShow(this.tabs[this.currentTabKey]);

                    this.currentTabKey = tabKey;

                    $(".nav-pills li" ).removeClass("active");
                    $(".nav-pills li a[data-nav='" + tabKey + "']").parent().addClass("active");

                    Utils.truncateText();

                    this.updateUrlFromState();
                }
            },


            toggleColumn : function() {
                if($("body" ).is(".smallScreen")) {
                    $(".right-col" ).toggle();
                    $(".left-col" ).toggle();
                }
            },

            setDisplay : function(d,className) {
                this.displays[className] = d;

                this.onDisplayChange();
            },

            setDisplayClass : function(className) {
                if(className !== this.currentDisplayClass) {
                    if(this.displays[this.currentDisplayClass]) {
                        this.displays[this.currentDisplayClass].clear();
                    }

                    this.currentDisplayClass= className;
                }

                this.getCurrentDisplay().draw();
            },

            getCurrentDisplay : function( ){
                return this.getDisplay(this.currentDisplayClass);
            },

            getDisplay : function(className){
                if(!this.displays[className]) {
                    this.setDisplay(new window[className](), className);
                }

                return this.displays[className];
            },

            onDisplayChange : function(tabsToSkip) {
                if(typeof tabsToSkip === "undefined") {
                    tabsToSkip = [];
                }

                for(var tabKey in this.tabs) {
                    if(this.tabs.hasOwnProperty(tabKey)) {
                        var t = this.tabs[tabKey];

                        if(tabsToSkip.indexOf(t) < 0 && t.displayClassName === this.currentDisplayClass) {
                            t.onDisplayChange(); //broadcast it to tabs that care
                        }
                    }
                }

                this.updateUrlFromState();
            },

            updateUrlFromState : function() {
                Utils.setCurrentUrl(this.toUrl());
            },

            toUrl : function() {
                var page = this.currentTabKey;
                var url = global.config.statsUrl + "?p=" + page;
                if(this.displays[this.currentDisplayClass]) {
                    var displayObj = this.displays[this.currentDisplayClass].toObj();
                    var displayUrl = encodeURIComponent(JSON.stringify(displayObj));

                     url += "&c=" + this.currentDisplayClass  + "&d=" + displayUrl;
                }

                return url;
            },

            fromUrl : function() {
                var queryObj = Utils.parseQueryString(Utils.getCurrentUrl());

                if(queryObj.hasOwnProperty("c")) {
                    var className = queryObj.c;

                    if(this.displays.hasOwnProperty(className)) {
                        this.currentDisplayClass = className;
                    }

                    if(queryObj.hasOwnProperty("d")) {
                        var data = JSON.parse(queryObj.d);
                        var display = window[this.currentDisplayClass].fromObj(data);
                        if(display) {
                            this.setDisplay(display,className);
                            display.load();
                        }
                    }
                }

                if(queryObj.hasOwnProperty("p")) {
                    this.setTab(queryObj.p);
                }
            }

        };

        return self;
    })();



})(jQuery, window);

﻿$(function () {
    WorkSiteBrowser.Init();

    $("#browse").click(function () {
        var folders = WorkSiteBrowser.SelectFolders();

        if (folders) {
            FolderManager.Init(folders)
            FolderManager.Insert();
            $("#save").removeClass("disabled");
        }
    });

    $("#save").click(function () {
        $("#modal-save").modal({
            backdrop: "static",
            keyboard: false
        });
    });

    $("#modal-root-remove").on("show.bs.modal", function (event) {
        var modal = $(this)
        modal.find("#remove-button").on("click", function () {
            FolderManager.Remove(modal.find("#folderid").val());
        });
    });

    $("#modal-save").on("shown.bs.modal", function (event) {
        FolderManager.SaveAll();
    });
});

var WorkSiteFolder = (function () {
    // *** private properties
    var _serviceUrl = "http://sp2007-dev-02:666/WorksiteWeb.svc/";
    var _dmsUsername = "wsadmin";
    var _dmsPassword = "phoenix";

    // *** public properties
    this.Id;
    this.ParentId;
    this.Server;
    this.Database;

    // summary
    this.Name;
    this.Type;
    this.SubFolderCount;
    this.DocumentCount;

    // template
    this.Template;
    this.SummaryRowRef;
    this.ButtonRowRef;
    this.DetailsRowRef;
    this.TreeRef;
    this.GridRef;

    // data
    this.TreeData;
    this.ActiveNodeRef;

    // *** constructor
    function WorkSiteFolder(id, parentId, server, database, type) {
        this.Id = id;
        this.ParentId = parentId;
        this.Server = server;
        this.Database = database;
        this.Type = type;
        this.Template = $("#folder-template").clone();
        this.TreeData = true;
    }

    // *** private methods
    function _databind() {
        var folder = this;
        folder.Template.find("#id-pbs-0").text(folder.Id);
        folder.Template.find("#name-pbs-0").text(folder.Name);
        folder.Template.find("#type-pbs-0").text(folder.Type);
        folder.Template.find("#subfolders-pbs-0").text(folder.SubFolderCount);
        folder.Template.find("#documents-pbs-0").text(folder.DocumentCount);
        folder.Template.find("#hdn-objectid-pbs-0").val(folder.Id);
        folder.Template.find("#btn-showdetails-pbs-0").attr("onclick", "FolderManager.ShowDetails(this.id.replace('btn-showdetails-pbs-', '')); return false;");
        folder.Template.find("#btn-remove-pbs-0").attr("onclick", "FolderManager.Remove(this.id.replace('btn-remove-pbs-', '')); return false;");
        folder.Template.find("[id$='pbs-0']").each(function () {
            this.id = this.id.replace(0, folder.Id);
        });
    }

    function _showGrid() {
        var folder = this;
        var gridPanel = folder.DetailsRowRef.find("#grid-panel-pbs-" + folder.Id);

        folder.GridRef.dataTable({
            data: folder.ActiveNodeRef.documents,
            columns:
            [
                { "data": "docnum" },
                { "data": "description" }
            ],
            pagingType: "simple",
            initComplete: function () {
                var gridPlaceholder = folder.DetailsRowRef.find("#grid-placeholder-pbs-" + folder.Id);
                gridPlaceholder.fadeOut("fast", function () {
                    gridPanel.show();
                });

                var dt = folder.GridRef.dataTable().api();

                var lastIdx = null;
                folder.GridRef.on("mouseover", "td", function () {
                    if (dt.cell(this).index()) {
                        var colIdx = dt.cell(this).index().column;

                        if (colIdx !== lastIdx) {
                            $(dt.cells().nodes()).removeClass("highlight");
                            $(dt.column(colIdx).nodes()).addClass("highlight");
                        }
                    }
                })
                .on("mouseleave", function () {
                    $(dt.cells().nodes()).removeClass("highlight");
                })
                .on("click", "tr", function () {
                    $(this).toggleClass("active");
                })

                var gridSelectAll = folder.DetailsRowRef.find("#btn-grid-selectall-pbs-" + folder.Id);
                var gridDeSelectAll = folder.DetailsRowRef.find("#btn-grid-deselectall-pbs-" + folder.Id);
                var gridRemoveSelected = folder.DetailsRowRef.find("#btn-grid-removeselected-pbs-" + folder.Id);

                if (0 === dt.cells().nodes().length) {
                    gridSelectAll.addClass("disabled");
                    gridDeSelectAll.addClass("disabled");
                    gridRemoveSelected.addClass("disabled");
                }
                else {
                    gridSelectAll.removeClass("disabled");
                    gridSelectAll.on("click", function () {
                        folder.GridRef.find("tr").each(function () {
                            $(this).addClass("active");
                        });
                        return false;
                    });

                    gridDeSelectAll.removeClass("disabled");
                    gridDeSelectAll.on("click", function () {
                        folder.GridRef.find("tr").each(function () {
                            $(this).removeClass("active");
                        });
                        return false;
                    });

                    gridRemoveSelected.removeClass("disabled");
                    gridRemoveSelected.on("click", function () {
                        dt.row(".active").remove().draw(false);
                        if (0 === dt.cells().nodes().length) {
                            gridSelectAll.addClass("disabled");
                            gridDeSelectAll.addClass("disabled");
                            gridRemoveSelected.addClass("disabled");
                        }
                        var docs = dt.data();
                        folder.ActiveNodeRef.documents = [];
                        for (var i = 0; i < docs.length; i++) {
                            folder.ActiveNodeRef.documents[i] = docs[i];
                        }
                        return false;
                    });
                }
            }
        });
    }

    function _renderGrid() {
        var folder = this;
        var gridPanel = folder.DetailsRowRef.find("#grid-panel-pbs-" + folder.Id);

        if ($.fn.dataTable.isDataTable(folder.GridRef)) {
            var gridPlaceholder = folder.DetailsRowRef.find("#grid-placeholder-pbs-" + folder.Id);
            gridPanel.fadeOut("fast", function () {
                folder.GridRef.dataTable().fnDestroy();
                var parent = folder.GridRef.parent();
                folder.GridRef.remove();
                // todo: refactor this
                parent.append(
'<table id="grid-pbs-' + folder.Id + '" class="table table-striped table-bordered">' +
'   <thead>' +
'       <tr>' +
'           <th>DocNum</th>' +
'           <th>Description</th>' +
'       </tr>' +
'   </thead>' +
'</table>'
                );
                folder.GridRef = folder.DetailsRowRef.find("#grid-pbs-" + folder.Id);
                gridPlaceholder.show();
                _showGrid.call(folder);
            });
        } else {
            _showGrid.call(folder);
        }
    }

    function _findNode(tree, nodeId, doRemove) {
        var result;
        var node = $.grep(tree, function (item) {
            if (nodeId != item.id) {
                if (Array === item.children.constructor) {
                    var node2 = _findNode(item.children, nodeId, doRemove);
                    if (node2) {
                        result = node2;
                    }
                }
            } else {
                return true;
            }
            return false;
        })[0]
        if (node) {
            result = node;
            if (doRemove) {
                var i = tree.indexOf(node);
                tree = tree.splice(i, 1);
            }
        }
        return result;
    }

    function _initGrid(nodeId) {
        var folder = this;

        if (nodeId == folder.TreeData.id) {
            folder.ActiveNodeRef = folder.TreeData;
        } else {
            folder.ActiveNodeRef = _findNode(folder.TreeData.children, nodeId, false);
        }

        if (Array !== folder.ActiveNodeRef.documents.constructor) {
            if (true === folder.ActiveNodeRef.documents) {
                $.ajax({
                    url: _serviceUrl + "GetDocuments?database=" + folder.Database + "&id=" + nodeId,
                    headers: { "dmsServer": folder.Server, "dmsUsername": _dmsUsername, "dmsPassword": _dmsPassword },
                    type: "get",
                    dataType: "json",
                    cache: false,
                    success: function (documents) {
                        folder.ActiveNodeRef.documents = documents;
                        _renderGrid.call(folder);
                    }
                });
            } else {
                _renderGrid.call(folder);
            }
        } else {
            _renderGrid.call(folder);
        }
    }

    function _renderTree() {
        var folder = this;
        folder.TreeRef.jstree({
            "core": {
                "check_callback": true,
                "data": function (node, cb) {
                    if ("#" === node.id) {
                        // root node
                        var treeData = $.extend(true, {}, folder.TreeData);
                        cb.call(this, treeData);
                    } else {
                        // leaf node
                        // todo: refactor
                        var treeData = null;
                        var expandedNode = _findNode(folder.TreeData.children, node.id, false);

                        if (Array === expandedNode.children.constructor) {
                            treeData = $.extend(true, {}, expandedNode);
                            cb.call(this, treeData);
                        } else {
                            $.ajax({
                                url: _serviceUrl + "GetTree?database=" + folder.Database + "&id=" + node.id + "&type=documentfolder",
                                headers: { "dmsServer": folder.Server, "dmsUsername": _dmsUsername, "dmsPassword": _dmsPassword },
                                type: "get",
                                dataType: "json",
                                cache: false,
                                success: function (result) {
                                    expandedNode.children = result.children;
                                    treeData = $.extend(true, {}, expandedNode);
                                    cb.call(this, treeData);
                                }
                            });
                        }
                    }
                },
                "themes": { name: "proton" }
            }
        })
        .bind("ready.jstree", function (e, data) {
            var placeHolder = folder.DetailsRowRef.find("#tree-placeholder-pbs-" + folder.Id);
            var treeRow = folder.DetailsRowRef.find("#tree-row-pbs-" + folder.Id);
            placeHolder.fadeOut("fast", function () {
                treeRow.show();
                _initGrid.call(folder, folder.Id);
            });
        })
        .bind("select_node.jstree", function (e, data) {
            var nodeId = data.node.id;
            _initGrid.call(folder, nodeId)
        });

        //folder.DetailsRowRef.find("#btn-tree-selectall-pbs-" + folder.Id).click(function () {
        //    //folder.TreeRef.jstree("check_all");
        //    folder.TreeRef.jstree("select_all");
        //    return false;
        //});

        //folder.DetailsRowRef.find("#btn-tree-deselectall-pbs-" + folder.Id).click(function () {
        //    //folder.TreeRef.jstree("uncheck_all");
        //    folder.TreeRef.jstree("deselect_all");
        //    return false;
        //});

        folder.DetailsRowRef.find("#btn-tree-removeselected-pbs-" + folder.Id).click(function () {
            //var nodes = folder.TreeRef.jstree("get_checked");
            //var nodes = folder.TreeRef.jstree("get_selected");
            var nodeId = folder.TreeRef.jstree("get_selected")[0];

            //for (var i = 0; i < nodes.length; i++) {
            //    var nodeId = nodes[i];
            var node = folder.TreeRef.jstree("get_node", nodeId);
            if ("#" === node.parent) {
                $("#modal-root-remove").find("#folderid").val(node.id);
                $("#modal-root-remove").modal();
            } else {
                _findNode(folder.TreeData.children, node.id, true);
                folder.TreeRef.jstree("delete_node", node);
                folder.TreeRef.jstree("select_node", folder.Id);
            }
            //}
            return false;
        });
    }

    function _initTree() {
        var folder = this;
        if (folder.TreeData && Array !== folder.TreeData.constructor) {
            $.ajax({
                url: _serviceUrl + "GetTree?database=" + folder.Database + "&id=" + folder.Id + "&type=" + folder.Type,
                headers: { "dmsServer": folder.Server, "dmsUsername": _dmsUsername, "dmsPassword": _dmsPassword },
                type: "get",
                dataType: "json",
                cache: false,
                success: function (treeData) {
                    folder.TreeData = treeData;
                    _renderTree.call(folder);
                }
            });
        } else {
            _renderTree.call(folder);
        }
    }

    // *** public methods
    WorkSiteFolder.prototype.Insert = function () {
        var hidden = $("#main").find("#hdn-objectid-pbs-" + this.Id);
        if (!hidden.length) {
            var folder = this;

            var placeHolder = $("#folder-placeholder").clone();
            placeHolder.find("[id='folder-placeholder-0']").each(function () {
                this.id = this.id.replace(0, folder.Id);
            });

            $("#main").append(placeHolder.html());
            $.ajax({
                // todo: remove Type from here once the core library is updated
                url: _serviceUrl + "GetSummary?database=" + folder.Database + "&id=" + folder.Id + "&type=" + folder.Type,
                headers: { "dmsServer": folder.Server, "dmsUsername": _dmsUsername, "dmsPassword": _dmsPassword },
                async: true,
                type: "get",
                dataType: "json",
                cache: false,
                success: function (summary) {
                    folder.Name = summary.name;
                    folder.Type = summary.type;
                    folder.SubFolderCount = summary.subfolders;
                    folder.DocumentCount = summary.documents;
                    _databind.call(folder);
                    var placeHolderRef = $("#folder-placeholder-" + folder.Id);
                    placeHolderRef.fadeOut("fast", function () {
                        placeHolderRef.replaceWith(folder.Template.html());
                    })
                },
                error: function () {
                    var placeHolderRef = $("#folder-placeholder-" + folder.Id);
                    placeHolderRef.find("div.panel").replaceWith('<div class="alert alert-danger">An error occurred.</div>');
                }
            });
        }
    }

    WorkSiteFolder.prototype.ShowDetails = function () {
        var hidden = $("#main").find("#hdn-objectid-pbs-" + this.Id);
        this.SummaryRowRef = hidden.parents("div.well").find("div:nth-child(1)");
        this.ButtonRowRef = hidden.parents("div.well").find("div:nth-child(2)");
        this.DetailsRowRef = hidden.parents("div.well").find("div:nth-child(3)");
        this.TreeRef = this.DetailsRowRef.find("#tree-pbs-" + this.Id);
        this.GridRef = this.DetailsRowRef.find("#grid-pbs-" + this.Id);

        if (this.TreeRef.is(":empty")) {
            _initTree.call(this);
        }
        this.DetailsRowRef.slideDown("fast");
        var button = this.ButtonRowRef.find("#btn-showdetails-pbs-" + this.Id);
        button.text("Hide Details");
        button.attr("onClick", "FolderManager.HideDetails(this.id.replace('btn-showdetails-pbs-', '')); return false;");
    }

    WorkSiteFolder.prototype.HideDetails = function () {
        this.DetailsRowRef.slideUp("fast");
        var button = this.ButtonRowRef.find("#btn-showdetails-pbs-" + this.Id);
        button.text("Show Details");
        button.attr("onClick", "FolderManager.ShowDetails(this.id.replace('btn-showdetails-pbs-', '')); return false;");
    }

    WorkSiteFolder.prototype.Remove = function () {
        var panel = $("#main").find("#hdn-objectid-pbs-" + this.Id).closest("div.container").parent();
        panel.fadeOut("fast", function () {
            panel.remove();
        });
    }

    WorkSiteFolder.prototype.Save = function () {
        var folder = this;
        var data;
        if (Object === folder.TreeData.constructor) {
            // todo: there must be an equivalent filtering function that doesn't require serializing/deserializing
            // todo: look at $.map()
            var str = JSON.stringify(folder.TreeData, ["id", "server", "database", "children", "documents", "text", "docnum"]);
            data = JSON.parse(str);
        } else {
            data = {
                id: folder.Id,
                server: folder.Server,
                database: folder.Database,
                children: folder.SubFolderCount > 0,
                documents: folder.DocumentCount > 0,
                text: folder.Name
            };
        }
        $.ajax({
            url: _serviceUrl + "SaveFolder",
            headers: { "dmsServer": folder.Server, "dmsUsername": _dmsUsername, "dmsPassword": _dmsPassword },
            async: false,
            cache: false,
            type: "post",
            data: data,
            dataType: "json",
            success: function () {
                // todo: update the dialog
                alert("saved");
            },
            error: function () {
                // todo: update the dialog
                alert("failed");
            }
        });
    }
    return WorkSiteFolder;
})();

var FolderManager = function () {
    var _rootFolders = [];

    var _init = function (folders) {
        $.each(folders, function (i, e) {
            var tokens = e.split("!");
            var server = tokens[2].split(":")[1];
            var database = tokens[3].split(":")[1];
            var type = tokens[4].split(":")[0].toLowerCase();
            var id = 0;

            if ("page" === type) {
                id = tokens[4].split(":")[1];
                type = "Workspace";
            }
            else if ("tab" === type) {
                id = tokens[4].split(":")[1];
                type = "Tab";
            }
            else //if ("folder" === type)
            {
                id = tokens[4].split(":")[1].split(",")[1];
                type = "DocumentFolder";
            }
            _rootFolders[id] = new WorkSiteFolder(id, null, server, database, type);
        });
    }

    var _insert = function () {
        for (var folderId in _rootFolders) {
            var folder = _rootFolders[folderId];
            folder.Insert();
        }
    }

    var _showDetails = function (folderId) {
        _rootFolders[folderId].ShowDetails();
    }

    var _hideDetails = function (folderId) {
        _rootFolders[folderId].HideDetails();
    }

    var _saveAll = function () {
        for (var folderId in _rootFolders) {
            var folder = _rootFolders[folderId];
            var saved = folder.Save();
            // todo: 
        }
    }

    return {
        Init: function (folders) {
            _init(folders);
        },

        Insert: function () {
            _insert();
        },

        ShowDetails: function (folderId) {
            _showDetails(folderId);
        },

        HideDetails: function (folderId) {
            _hideDetails(folderId);
        },

        Remove: function (folderId) {
            _rootFolders[folderId].Remove();
            delete _rootFolders[folderId];
            if (0 === Object.keys(_rootFolders).length) {
                $("#save").addClass("disabled");
            }
        },

        SaveAll: function () {
            _saveAll();
        }
    }
}();